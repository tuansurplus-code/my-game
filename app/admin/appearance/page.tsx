"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Prize = { id: string; name: string; active: boolean; sort_order: number };
type WheelSettings = {
  id: number; title: string; subtitle: string; button_text: string; page_background_color: string;
  button_color: string; button_text_color: string; pointer_color: string; center_color: string;
  text_color: string; logo_url: string | null; font_family: string; animation_duration: number;
  header_text: string; online_text: string; segment_colors: Record<string, string>;
};

const palette = ["#e31b23", "#f4b400", "#1583d8", "#18a05e", "#7139a5", "#e36c19", "#008b8b", "#d63384", "#6f42c1", "#495057"];
const defaults: WheelSettings = {
  id: 1, title: "SPIN & WIN", subtitle: "Spin daily and win exciting rewards!", button_text: "SPIN NOW",
  page_background_color: "#ffffff", button_color: "#e31b23", button_text_color: "#ffffff", pointer_color: "#e31b23",
  center_color: "#e31b23", text_color: "#ffffff", logo_url: "", font_family: "Arial, sans-serif", animation_duration: 5.2,
  header_text: "SINGHAGIRI", online_text: "SINGHAGIRI ONLINE", segment_colors: {},
};
const selectFields = "id,title,subtitle,button_text,page_background_color,button_color,button_text_color,pointer_color,center_color,text_color,logo_url,font_family,animation_duration,header_text,online_text,segment_colors";

export default function WheelAppearancePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [settings, setSettings] = useState<WheelSettings>(defaults);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { checkAdmin(); }, []);
  async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.replace("/admin/login"); return; }
    const { data: admin, error: adminError } = await supabase.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
    if (adminError || !admin) { await supabase.auth.signOut(); router.replace("/admin/login"); return; }
    setChecking(false); await Promise.all([loadSettings(), loadPrizes()]);
  }
  async function loadSettings() {
    const { data, error } = await supabase.from("wheel_settings").select(selectFields).eq("id", 1).maybeSingle();
    if (error) { console.error(error); setError("Unable to load wheel appearance settings."); return; }
    if (data) {
      const colors = data.segment_colors && typeof data.segment_colors === "object" && !Array.isArray(data.segment_colors) ? data.segment_colors : {};
      setSettings({ ...defaults, ...data, logo_url: data.logo_url || "", animation_duration: Number(data.animation_duration) || 5.2, segment_colors: colors });
    }
  }
  async function loadPrizes() {
    const { data, error } = await supabase.from("prizes").select("id,name,active,sort_order").order("sort_order", { ascending: true });
    if (error) { console.error(error); setError("Unable to load prizes for wheel segments."); return; }
    setPrizes((data || []) as Prize[]);
  }
  function updateSetting<K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) {
    setSettings(current => ({ ...current, [key]: value })); setMessage(""); setError("");
  }
  function getPrizeColor(prize: Prize, index: number) { return settings.segment_colors[prize.id] || palette[index % palette.length]; }
  function updatePrizeColor(prizeId: string, color: string) {
    setSettings(current => ({ ...current, segment_colors: { ...current.segment_colors, [prizeId]: color } })); setMessage(""); setError("");
  }
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    const duration = Number(settings.animation_duration);
    if (!Number.isFinite(duration) || duration < 1 || duration > 10) { setError("Animation duration must be between 1 and 10 seconds."); setSaving(false); return; }
    const normalizedColors: Record<string, string> = { ...settings.segment_colors };
    prizes.forEach((prize, index) => { if (!normalizedColors[prize.id]) normalizedColors[prize.id] = palette[index % palette.length]; });
    const payload = {
      title: settings.title.trim() || "SPIN & WIN", subtitle: settings.subtitle.trim() || "Spin daily and win exciting rewards!", button_text: settings.button_text.trim() || "SPIN NOW",
      page_background_color: settings.page_background_color, button_color: settings.button_color, button_text_color: settings.button_text_color,
      pointer_color: settings.pointer_color, center_color: settings.center_color, text_color: settings.text_color, logo_url: settings.logo_url?.trim() || null,
      font_family: settings.font_family, animation_duration: duration, header_text: settings.header_text.trim() || "SINGHAGIRI",
      online_text: settings.online_text.trim() || "SINGHAGIRI ONLINE", segment_colors: normalizedColors, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("wheel_settings").update(payload).eq("id", 1);
    if (error) { console.error(error); setError(error.message || "Unable to save appearance settings."); setSaving(false); return; }
    setSettings(current => ({ ...current, ...payload, logo_url: payload.logo_url || "", animation_duration: duration, segment_colors: normalizedColors }));
    setMessage("Wheel appearance settings saved successfully."); setSaving(false);
  }
  function resetDefaults() {
    if (!window.confirm("Reset the wheel appearance form to the default design?")) return;
    const resetColors: Record<string, string> = {}; prizes.forEach((prize, index) => { resetColors[prize.id] = palette[index % palette.length]; });
    setSettings({ ...defaults, segment_colors: resetColors }); setMessage(""); setError("");
  }
  async function logout() { await supabase.auth.signOut(); router.replace("/admin/login"); }

  const activePrizes = prizes.filter(prize => prize.active);
  const previewSegments = activePrizes.map((prize, index) => getPrizeColor(prize, index));
  const previewGradient = previewSegments.length ? `conic-gradient(${previewSegments.map((color, index) => `${color} ${(index * 100) / previewSegments.length}% ${((index + 1) * 100) / previewSegments.length}%`).join(", ")})` : "#eeeeee";

  if (checking) return <main className="page loading-page"><div className="loading-card">Checking admin access...</div></main>;
  return (
    <main className="page" style={{ background: settings.page_background_color }}>
      <div className="topbar"><div><div className="brand">SINGHAGIRI</div><div className="brand-sub">SPIN & WIN ADMIN</div></div><div className="top-actions"><button onClick={() => router.push("/admin")}>← Dashboard</button><button onClick={logout}>Logout</button></div></div>
      <div className="content">
        <div className="heading"><h1>Wheel Appearance</h1><p>Manage the customer-facing Spin & Win appearance and the color of each prize segment.</p></div>
        {message && <div className="success">✓ {message}</div>}{error && <div className="error">! {error}</div>}
        <form onSubmit={saveSettings} className="layout">
          <section className="card settings-card">
            <div className="card-title">Branding & Content</div>
            <label>Header Brand Text<input value={settings.header_text} onChange={e => updateSetting("header_text", e.target.value)} maxLength={40} /></label>
            <label>Online Brand Text<input value={settings.online_text} onChange={e => updateSetting("online_text", e.target.value)} maxLength={50} /></label>
            <label>Wheel Title<input value={settings.title} onChange={e => updateSetting("title", e.target.value)} maxLength={40} /></label>
            <label>Subtitle<input value={settings.subtitle} onChange={e => updateSetting("subtitle", e.target.value)} maxLength={100} /></label>
            <label>Spin Button Text<input value={settings.button_text} onChange={e => updateSetting("button_text", e.target.value)} maxLength={25} /></label>
            <label>Logo URL<input type="url" placeholder="https://..." value={settings.logo_url || ""} onChange={e => updateSetting("logo_url", e.target.value)} /><small>Paste a public image URL for the logo.</small></label>
            <label>Font Family<select value={settings.font_family} onChange={e => updateSetting("font_family", e.target.value)}><option value="Arial, sans-serif">Arial</option><option value="Verdana, sans-serif">Verdana</option><option value="Trebuchet MS, sans-serif">Trebuchet MS</option><option value="Georgia, serif">Georgia</option><option value="system-ui, sans-serif">System UI</option></select></label>
            <div className="card-title spacing">General Colors</div>
            <ColorField label="Page Background" value={settings.page_background_color} onChange={value => updateSetting("page_background_color", value)} />
            <ColorField label="Button Color" value={settings.button_color} onChange={value => updateSetting("button_color", value)} />
            <ColorField label="Button Text Color" value={settings.button_text_color} onChange={value => updateSetting("button_text_color", value)} />
            <ColorField label="Pointer Color" value={settings.pointer_color} onChange={value => updateSetting("pointer_color", value)} />
            <ColorField label="Wheel Center Color" value={settings.center_color} onChange={value => updateSetting("center_color", value)} />
            <ColorField label="Wheel Text Color" value={settings.text_color} onChange={value => updateSetting("text_color", value)} />
            <div className="card-title spacing">Wheel Segments</div>
            <p className="helper">Each prize has its own segment color. New prizes appear here automatically.</p>
            {prizes.length === 0 ? <div className="empty">No prizes found.</div> : <div className="segment-list">{prizes.map((prize, index) => <div className={`segment-row ${!prize.active ? "inactive" : ""}`} key={prize.id}>
              <div className="segment-number">{index + 1}</div><div className="segment-name"><strong>{prize.name}</strong><small>{prize.active ? "Active on wheel" : "Inactive — not shown on wheel"}</small></div>
              <ColorField compact label="Color" value={getPrizeColor(prize, index)} onChange={value => updatePrizeColor(prize.id, value)} />
            </div>)}</div>}
            <div className="card-title spacing">Animation</div>
            <label>Spin Animation Duration: {settings.animation_duration.toFixed(1)} seconds<input type="range" min="1" max="10" step="0.1" value={settings.animation_duration} onChange={e => updateSetting("animation_duration", Number(e.target.value))} /></label>
            <div className="form-actions"><button type="button" className="secondary" onClick={resetDefaults} disabled={saving}>Reset Form</button><button type="submit" className="primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button></div>
          </section>
          <section className="card preview-card"><div className="card-title">Live Preview</div>
            <div className="preview" style={{ fontFamily: settings.font_family, background: settings.page_background_color }}>
              <div className="preview-header"><b>{settings.header_text}</b><span>{settings.title}</span></div>{settings.logo_url && <img className="preview-logo" src={settings.logo_url} alt="Logo preview" />}
              <div className="preview-online">{settings.online_text}</div><div className="preview-title">{settings.title}</div><div className="preview-subtitle">{settings.subtitle}</div>
              <div className="mini-wheel"><div className="mini-pointer" style={{ color: settings.pointer_color }}>▼</div><div className="mini-segments" style={{ background: previewGradient }}></div><div className="mini-center" style={{ background: settings.center_color }}><strong style={{ color: settings.text_color }}>SPIN</strong><small style={{ color: settings.text_color }}>& WIN</small></div></div>
              <button type="button" className="preview-button" style={{ background: settings.button_color, color: settings.button_text_color }}>{settings.button_text}</button>
            </div><div className="preview-note">The preview uses the current active prizes. Save Changes to publish the settings to the customer page.</div>
          </section>
        </form>
      </div>
      <style jsx>{`
        *{box-sizing:border-box}.page{min-height:100vh;color:#222}.topbar{min-height:76px;padding:16px 28px;display:flex;align-items:center;justify-content:space-between;background:#111;color:white}.brand{font-size:18px;font-weight:900;letter-spacing:.08em}.brand-sub{margin-top:3px;font-size:9px;font-weight:800;opacity:.65;letter-spacing:.14em}.top-actions{display:flex;gap:8px}.top-actions button{border:1px solid #444;background:#1d1d1d;color:white;border-radius:8px;padding:9px 12px;font-size:11px;font-weight:800;cursor:pointer}.content{max-width:1180px;margin:0 auto;padding:30px 22px 50px}.heading h1{margin:0;font-size:28px}.heading p{margin:6px 0 0;color:#777;font-size:13px}.success,.error{margin-top:18px;padding:12px 14px;border-radius:9px;font-size:12px;font-weight:700}.success{background:#eaf8ef;color:#19703a}.error{background:#fff0f0;color:#a51d2d}.layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(320px,.9fr);gap:20px;margin-top:22px;align-items:start}.card{background:white;border:1px solid #e4e4e4;border-radius:14px;box-shadow:0 5px 20px rgba(0,0,0,.05);padding:22px}.card-title{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;margin-bottom:18px}.spacing{margin-top:28px}label{display:block;margin-bottom:15px;font-size:11px;font-weight:900;color:#444}input,select{width:100%;margin-top:7px;padding:11px 12px;border:1px solid #d8d8d8;border-radius:8px;background:white;color:#222;font:inherit;font-size:12px;outline:none}input:focus,select:focus{border-color:#999}small{display:block;margin-top:5px;color:#999;font-weight:500}input[type=range]{padding:0;accent-color:#e31b23}.color-row{display:grid;grid-template-columns:1fr 54px;gap:10px;align-items:end;margin-bottom:13px}.color-row.compact{grid-template-columns:1fr 44px;gap:7px;margin:0}.color-row label{margin:0}.color-picker{width:54px;height:38px;padding:3px;cursor:pointer}.color-row.compact .color-picker{width:44px;height:34px}.helper{margin:-6px 0 16px;color:#777;font-size:12px;line-height:1.5}.empty{padding:16px;border:1px dashed #ddd;border-radius:9px;color:#888;font-size:12px;text-align:center}.segment-list{display:grid;gap:9px}.segment-row{display:grid;grid-template-columns:30px minmax(0,1fr) 145px;gap:10px;align-items:center;padding:11px;border:1px solid #e4e4e4;border-radius:10px;background:#fafafa}.segment-row.inactive{opacity:.55}.segment-number{width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#222;color:white;font-size:11px;font-weight:900}.segment-name strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.segment-name small{margin-top:3px;font-size:10px}.form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:28px}.form-actions button{border:0;border-radius:8px;padding:11px 16px;font-size:11px;font-weight:900;cursor:pointer}.primary{background:#e31b23;color:white}.secondary{background:#eee;color:#333}button:disabled{opacity:.55;cursor:not-allowed}.preview-card{position:sticky;top:20px}.preview{min-height:620px;border-radius:12px;padding:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.preview-header{width:100%;min-height:44px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.92);border-bottom:1px solid rgba(0,0,0,.08)}.preview-header b{font-size:12px;letter-spacing:.05em}.preview-header span{font-size:9px;color:#777}.preview-logo{max-width:140px;max-height:45px;object-fit:contain;margin:12px auto 2px}.preview-online{margin-top:14px;color:#999;font-size:8px;font-weight:900;letter-spacing:.16em}.preview-title{margin-top:5px;font-size:25px;font-weight:950;letter-spacing:.04em}.preview-subtitle{margin-top:3px;color:#777;font-size:10px}.mini-wheel{position:relative;width:260px;height:260px;margin:22px auto 20px}.mini-segments{position:absolute;inset:0;border-radius:50%;border:8px solid #222;box-shadow:0 8px 18px rgba(0,0,0,.18)}.mini-pointer{position:absolute;top:-17px;left:50%;transform:translateX(-50%);z-index:3;font-size:30px;line-height:1}.mini-center{position:absolute;z-index:2;top:50%;left:50%;transform:translate(-50%,-50%);width:64px;height:64px;border:5px solid white;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.25)}.mini-center strong{font-size:12px}.mini-center small{margin:0;font-size:8px;font-weight:800}.preview-button{border:0;border-radius:9px;padding:12px 24px;font-size:12px;font-weight:900}.preview-note{margin-top:14px;color:#888;font-size:10px;line-height:1.5;text-align:center}.loading-page{display:flex;align-items:center;justify-content:center}.loading-card{padding:24px;color:#777;font-size:13px}@media(max-width:820px){.layout{grid-template-columns:1fr}.preview-card{position:static}.preview{min-height:520px}.segment-row{grid-template-columns:30px minmax(0,1fr) 125px}}@media(max-width:520px){.topbar{padding:14px 16px}.content{padding:22px 14px 40px}.card{padding:16px}.segment-row{grid-template-columns:28px minmax(0,1fr) 105px}.segment-name strong{font-size:11px}.color-row.compact{grid-template-columns:1fr 38px}.color-row.compact .color-picker{width:38px}.mini-wheel{width:220px;height:220px}}
      `}</style>
    </main>
  );
}

function ColorField({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean }) {
  return <div className={`color-row ${compact ? "compact" : ""}`}><label>{label}<input value={value} onChange={e => onChange(e.target.value)} maxLength={7} placeholder="#000000" /></label><input className="color-picker" type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={e => onChange(e.target.value)} aria-label={`${label} color picker`} /></div>;
}
