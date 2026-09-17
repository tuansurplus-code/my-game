"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Prize = { id: string; name: string; active: boolean; sort_order: number };
type Tab = "branding" | "colors" | "segments" | "animation";
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

const tabs: { id: Tab; label: string; icon: string; description: string }[] = [
  { id: "branding", label: "Branding & Content", icon: "✦", description: "Text, logo and typography" },
  { id: "colors", label: "General Colors", icon: "◈", description: "Page, button and wheel colors" },
  { id: "segments", label: "Wheel Segments", icon: "◉", description: "Set a color for each prize" },
  { id: "animation", label: "Animation", icon: "↻", description: "Spin speed and motion" },
];

export default function WheelAppearancePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("branding");
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
    setSettings({ ...defaults, segment_colors: resetColors }); setMessage(""); setError(""); setActiveTab("branding");
  }

  async function logout() { await supabase.auth.signOut(); router.replace("/admin/login"); }

  const activePrizes = prizes.filter(prize => prize.active);
  const previewSegments = activePrizes.map((prize, index) => getPrizeColor(prize, index));
  const previewGradient = previewSegments.length ? `conic-gradient(${previewSegments.map((color, index) => `${color} ${(index * 100) / previewSegments.length}% ${((index + 1) * 100) / previewSegments.length}%`).join(", ")})` : "#eeeeee";

  if (checking) return <main className="page loading-page"><div className="loading-card">Checking admin access...</div></main>;

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand-wrap"><div className="brand-mark">S</div><div><div className="brand">SINGHAGIRI</div><div className="brand-sub">SPIN & WIN ADMIN</div></div></div>
          <div className="top-actions"><button onClick={() => router.push("/admin")}>← Dashboard</button><button onClick={logout}>Logout</button></div>
        </div>
      </div>

      <div className="content">
        <div className="heading-row">
          <div><div className="eyebrow">CUSTOMIZATION</div><h1>Wheel Appearance</h1><p>Design the Spin & Win experience your customers see.</p></div>
          <div className="status-pill"><span /> Live configuration</div>
        </div>

        {message && <div className="alert success">✓ <span>{message}</span></div>}
        {error && <div className="alert error">! <span>{error}</span></div>}

        <form onSubmit={saveSettings}>
          <div className="workspace">
            <section className="card editor-card">
              <div className="tabs" role="tablist" aria-label="Wheel appearance sections">
                {tabs.map(tab => (
                  <button key={tab.id} type="button" className={`tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)} role="tab" aria-selected={activeTab === tab.id}>
                    <span className="tab-icon">{tab.icon}</span><span className="tab-copy"><strong>{tab.label}</strong><small>{tab.description}</small></span><span className="tab-arrow">›</span>
                  </button>
                ))}
              </div>

              <div className="editor-body">
                {activeTab === "branding" && <BrandingTab settings={settings} updateSetting={updateSetting} />}
                {activeTab === "colors" && <ColorsTab settings={settings} updateSetting={updateSetting} />}
                {activeTab === "segments" && <SegmentsTab prizes={prizes} getPrizeColor={getPrizeColor} updatePrizeColor={updatePrizeColor} />}
                {activeTab === "animation" && <AnimationTab settings={settings} updateSetting={updateSetting} />}

                <div className="form-footer">
                  <button type="button" className="secondary" onClick={resetDefaults} disabled={saving}>Reset to Default</button>
                  <button type="submit" className="primary" disabled={saving}><span>{saving ? "Saving..." : "Save Changes"}</span><b>→</b></button>
                </div>
              </div>
            </section>

            <section className="preview-column">
              <div className="preview-heading"><div><span>PREVIEW</span><strong>Customer View</strong></div><span className="live-dot"><i /> Live</span></div>
              <div className="preview-card">
                <div className="browser-bar"><span /><span /><span /><div>singhagiri.lk / spin & win</div></div>
                <div className="preview" style={{ fontFamily: settings.font_family, background: settings.page_background_color }}>
                  <div className="preview-header"><b>{settings.header_text}</b><span>SPIN & WIN</span></div>
                  {settings.logo_url && <img className="preview-logo" src={settings.logo_url} alt="Logo preview" />}
                  <div className="preview-online">{settings.online_text}</div>
                  <div className="preview-title">{settings.title}</div>
                  <div className="preview-subtitle">{settings.subtitle}</div>
                  <div className="mini-wheel"><div className="mini-pointer" style={{ color: settings.pointer_color }}>▼</div><div className="mini-segments" style={{ background: previewGradient }}></div><div className="mini-center" style={{ background: settings.center_color }}><strong style={{ color: settings.text_color }}>SPIN</strong><small style={{ color: settings.text_color }}>& WIN</small></div></div>
                  <button type="button" className="preview-button" style={{ background: settings.button_color, color: settings.button_text_color }}>{settings.button_text}</button>
                </div>
              </div>
              <div className="preview-meta"><div><b>{activePrizes.length}</b><span>Active prizes</span></div><div><b>{settings.animation_duration.toFixed(1)}s</b><span>Spin duration</span></div><div><b>100%</b><span>Responsive</span></div></div>
              <p className="preview-note">Preview updates instantly as you edit. Save Changes to publish your configuration.</p>
            </section>
          </div>
        </form>
      </div>

      <style jsx>{`
        *{box-sizing:border-box}.page{min-height:100vh;background:linear-gradient(145deg,#f6f7f9 0%,#eef1f5 100%);color:#17191d}.topbar{height:78px;background:#101114;color:#fff;box-shadow:0 2px 14px rgba(0,0,0,.16)}.topbar-inner{height:100%;max-width:1240px;margin:auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between}.brand-wrap{display:flex;align-items:center;gap:11px}.brand-mark{width:35px;height:35px;border-radius:10px;background:#e31b23;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:950;box-shadow:0 5px 14px rgba(227,27,35,.3)}.brand{font-size:16px;font-weight:950;letter-spacing:.12em}.brand-sub{margin-top:3px;font-size:8px;font-weight:800;letter-spacing:.16em;opacity:.55}.top-actions{display:flex;gap:8px}.top-actions button{border:1px solid #34363b;background:#1b1d21;color:#fff;border-radius:9px;padding:9px 13px;font-size:11px;font-weight:800;cursor:pointer;transition:.18s}.top-actions button:hover{background:#292b30}.content{max-width:1240px;margin:auto;padding:32px 24px 55px}.heading-row{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.eyebrow{font-size:9px;font-weight:950;letter-spacing:.16em;color:#e31b23;margin-bottom:6px}.heading-row h1{margin:0;font-size:30px;letter-spacing:-.035em}.heading-row p{margin:7px 0 0;color:#777;font-size:13px}.status-pill{display:flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid #dfe3e8;border-radius:999px;background:rgba(255,255,255,.7);font-size:10px;font-weight:800;color:#666}.status-pill span,.live-dot i{width:7px;height:7px;border-radius:50%;background:#18a05e;box-shadow:0 0 0 3px rgba(24,160,94,.12)}.alert{margin-top:18px;padding:12px 15px;border-radius:11px;display:flex;gap:9px;align-items:center;font-size:12px;font-weight:800}.success{background:#eaf8ef;border:1px solid #c9ecd5;color:#19703a}.error{background:#fff0f0;border:1px solid #f1c8cd;color:#a51d2d}.workspace{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.92fr);gap:22px;margin-top:24px;align-items:start}.card,.preview-card{background:rgba(255,255,255,.94);border:1px solid #e1e5e9;border-radius:17px;box-shadow:0 12px 35px rgba(26,34,46,.07)}.editor-card{overflow:hidden;display:grid;grid-template-columns:205px minmax(0,1fr);min-height:670px}.tabs{background:#f7f8fa;border-right:1px solid #e6e8eb;padding:12px}.tab{width:100%;border:0;background:transparent;text-align:left;display:flex;align-items:center;gap:10px;padding:12px 10px;border-radius:11px;margin-bottom:5px;color:#70757d;cursor:pointer;transition:.18s}.tab:hover{background:#eceff2;color:#282b30}.tab.active{background:#fff;color:#17191d;box-shadow:0 5px 16px rgba(22,28,35,.07);border:1px solid #e4e6e9}.tab-icon{width:30px;height:30px;flex:none;border-radius:9px;background:#eceff2;display:flex;align-items:center;justify-content:center;font-size:14px;color:#777}.tab.active .tab-icon{background:#fff0f1;color:#e31b23}.tab-copy{min-width:0;flex:1}.tab-copy strong{display:block;font-size:11px;font-weight:900;line-height:1.3}.tab-copy small{display:block;margin-top:3px;font-size:8px;line-height:1.35;color:#999;font-weight:600}.tab-arrow{font-size:18px;opacity:.35}.tab.active .tab-arrow{color:#e31b23;opacity:1}.editor-body{padding:27px 29px 22px;min-width:0}.section-head{margin-bottom:22px}.section-head h2{margin:0;font-size:20px;letter-spacing:-.025em}.section-head p{margin:6px 0 0;color:#81868d;font-size:11px;line-height:1.55}.section-badge{display:inline-flex;margin-bottom:9px;padding:5px 8px;border-radius:6px;background:#f5f6f8;color:#8a8f96;font-size:8px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.fields{display:grid;grid-template-columns:1fr 1fr;gap:0 15px}.field-full{grid-column:1/-1}label{display:block;margin-bottom:17px;font-size:10px;font-weight:900;color:#454a51}input,select{width:100%;margin-top:7px;padding:11px 12px;border:1px solid #dce0e5;border-radius:9px;background:#fff;color:#202328;font:inherit;font-size:12px;outline:none;transition:.16s;box-shadow:0 1px 2px rgba(0,0,0,.02)}input:hover,select:hover{border-color:#c8cdd3}input:focus,select:focus{border-color:#aeb4bc;box-shadow:0 0 0 3px rgba(100,110,120,.08)}input[type=range]{padding:0;accent-color:#e31b23;box-shadow:none}small{display:block;margin-top:5px;color:#999;font-weight:500}.color-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.color-box{padding:13px;border:1px solid #e4e7eb;border-radius:12px;background:#fafbfc}.color-box label{margin:0}.color-row{display:grid;grid-template-columns:1fr 50px;gap:9px;align-items:end}.color-row.compact{grid-template-columns:1fr 42px;gap:7px;margin:0}.color-row label{margin:0}.color-picker{width:50px;height:38px;padding:3px;cursor:pointer}.color-row.compact .color-picker{width:42px;height:34px}.segment-list{display:grid;gap:9px;max-height:455px;overflow:auto;padding-right:3px}.segment-row{display:grid;grid-template-columns:32px minmax(0,1fr) 150px;gap:10px;align-items:center;padding:11px;border:1px solid #e4e7eb;border-radius:12px;background:#fafbfc;transition:.15s}.segment-row:hover{background:#fff;border-color:#d6dbe1;box-shadow:0 4px 12px rgba(0,0,0,.04)}.segment-row.inactive{opacity:.52}.segment-number{width:27px;height:27px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#202329;color:#fff;font-size:10px;font-weight:950}.segment-name{min-width:0}.segment-name strong{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.segment-name small{margin-top:3px;font-size:9px}.helper{margin:-7px 0 15px;color:#858b92;font-size:11px;line-height:1.5}.empty{padding:20px;border:1px dashed #d9dde2;border-radius:11px;color:#888;font-size:11px;text-align:center;background:#fafbfc}.segment-count{display:inline-flex;margin-left:7px;padding:4px 7px;border-radius:999px;background:#edf8f1;color:#19804a;font-size:8px;font-weight:900}.range-wrap{padding:18px;border:1px solid #e5e7ea;background:#fafbfc;border-radius:13px}.range-value{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}.range-value span{font-size:11px;font-weight:800;color:#555}.range-value b{font-size:20px;color:#e31b23}.animation-options{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:14px}.animation-chip{padding:12px 8px;border:1px solid #e2e5e9;border-radius:10px;background:#fff;text-align:center;font-size:10px;font-weight:800;color:#777;cursor:pointer}.animation-chip:hover{border-color:#cdd2d8;color:#333}.form-footer{border-top:1px solid #eceef1;margin:27px -29px 0;padding:18px 29px 0;display:flex;justify-content:flex-end;gap:9px}.form-footer button{border:0;border-radius:9px;padding:11px 16px;font-size:10px;font-weight:950;cursor:pointer;transition:.18s}.primary{background:#e31b23;color:#fff;box-shadow:0 5px 13px rgba(227,27,35,.2);display:flex;align-items:center;gap:14px}.primary:hover{background:#c91920;transform:translateY(-1px)}.primary b{font-size:15px;font-weight:500}.secondary{background:#f0f1f3;color:#444}.secondary:hover{background:#e6e8eb}button:disabled{opacity:.55;cursor:not-allowed;transform:none!important}.preview-column{position:sticky;top:20px}.preview-heading{display:flex;align-items:flex-end;justify-content:space-between;margin:0 3px 10px}.preview-heading span:first-child{display:block;color:#e31b23;font-size:8px;font-weight:950;letter-spacing:.15em}.preview-heading strong{display:block;margin-top:2px;font-size:13px}.live-dot{display:flex!important;align-items:center;gap:7px;color:#5e656d;font-size:9px;font-weight:800}.preview-card{overflow:hidden}.browser-bar{height:32px;background:#f1f3f5;border-bottom:1px solid #e0e3e6;display:flex;align-items:center;padding:0 11px;gap:5px}.browser-bar>span{width:6px;height:6px;border-radius:50%;background:#c8ccd1}.browser-bar div{margin:auto;background:#fff;border:1px solid #e2e4e7;border-radius:5px;padding:4px 30px;color:#a0a5ab;font-size:7px}.preview{min-height:625px;padding:15px 18px 22px;display:flex;flex-direction:column;align-items:center;text-align:center}.preview-header{width:100%;min-height:39px;padding:7px 9px;display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.92);border-bottom:1px solid rgba(0,0,0,.08)}.preview-header b{font-size:10px;letter-spacing:.05em}.preview-header span{font-size:7px;color:#777}.preview-logo{max-width:125px;max-height:42px;object-fit:contain;margin:10px auto 1px}.preview-online{margin-top:13px;color:#999;font-size:7px;font-weight:900;letter-spacing:.16em}.preview-title{margin-top:4px;font-size:24px;font-weight:950;letter-spacing:.03em}.preview-subtitle{margin-top:3px;color:#777;font-size:9px;max-width:260px}.mini-wheel{position:relative;width:235px;height:235px;margin:19px auto 17px}.mini-segments{position:absolute;inset:0;border-radius:50%;border:7px solid #222;box-shadow:0 10px 22px rgba(0,0,0,.17)}.mini-pointer{position:absolute;top:-15px;left:50%;transform:translateX(-50%);z-index:3;font-size:27px;line-height:1;text-shadow:0 2px 2px rgba(0,0,0,.12)}.mini-center{position:absolute;z-index:2;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border:5px solid white;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 3px 9px rgba(0,0,0,.25)}.mini-center strong{font-size:11px}.mini-center small{margin:0;font-size:7px;font-weight:800}.preview-button{border:0;border-radius:9px;padding:11px 24px;font-size:10px;font-weight:950;box-shadow:0 5px 12px rgba(0,0,0,.12)}.preview-meta{display:grid;grid-template-columns:repeat(3,1fr);margin-top:10px;background:#fff;border:1px solid #e1e5e9;border-radius:12px;padding:11px}.preview-meta>div{text-align:center;border-right:1px solid #eceef0}.preview-meta>div:last-child{border:0}.preview-meta b{display:block;font-size:12px}.preview-meta span{display:block;margin-top:3px;color:#999;font-size:8px}.preview-note{margin:10px 4px 0;color:#858b92;font-size:9px;line-height:1.5;text-align:center}.loading-page{display:flex;align-items:center;justify-content:center;background:#f5f6f8}.loading-card{padding:24px;color:#777;font-size:13px}@media(max-width:980px){.workspace{grid-template-columns:1fr}.preview-column{position:static}.editor-card{grid-template-columns:180px 1fr}}@media(max-width:720px){.content{padding:24px 14px 40px}.topbar-inner{padding:0 15px}.heading-row{align-items:flex-start}.status-pill{display:none}.editor-card{display:block}.tabs{display:grid;grid-template-columns:1fr 1fr;border-right:0;border-bottom:1px solid #e6e8eb}.tab{margin:0}.tab-copy small{display:none}.editor-body{padding:22px 18px}.fields,.color-grid{grid-template-columns:1fr}.field-full{grid-column:auto}.form-footer{margin-left:-18px;margin-right:-18px;padding-left:18px;padding-right:18px}.preview{min-height:570px}.preview-meta{display:none}}@media(max-width:450px){.tabs{grid-template-columns:1fr}.tab{padding:10px}.top-actions button{padding:8px 9px;font-size:10px}.brand{font-size:14px}.heading-row h1{font-size:25px}.editor-body{padding:19px 14px}.form-footer{margin-left:-14px;margin-right:-14px;padding-left:14px;padding-right:14px}.segment-row{grid-template-columns:29px minmax(0,1fr) 110px}.color-row.compact{grid-template-columns:1fr 38px}.color-row.compact .color-picker{width:38px}.mini-wheel{width:205px;height:205px}}
      `}</style>
    </main>
  );
}

function BrandingTab({ settings, updateSetting }: { settings: WheelSettings; updateSetting: <K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) => void }) {
  return <>
    <div className="section-head"><span className="section-badge">01 · Brand experience</span><h2>Branding & Content</h2><p>Control the text, logo and typography displayed on the customer Spin & Win page.</p></div>
    <div className="fields">
      <label>Header Brand Text<input value={settings.header_text} onChange={e => updateSetting("header_text", e.target.value)} maxLength={40} /></label>
      <label>Online Brand Text<input value={settings.online_text} onChange={e => updateSetting("online_text", e.target.value)} maxLength={50} /></label>
      <label>Wheel Title<input value={settings.title} onChange={e => updateSetting("title", e.target.value)} maxLength={40} /></label>
      <label>Spin Button Text<input value={settings.button_text} onChange={e => updateSetting("button_text", e.target.value)} maxLength={25} /></label>
      <label className="field-full">Subtitle<input value={settings.subtitle} onChange={e => updateSetting("subtitle", e.target.value)} maxLength={100} /></label>
      <label className="field-full">Logo URL<input type="url" placeholder="https://..." value={settings.logo_url || ""} onChange={e => updateSetting("logo_url", e.target.value)} /><small>Use a public image URL. Leave blank to hide the logo.</small></label>
      <label className="field-full">Font Family<select value={settings.font_family} onChange={e => updateSetting("font_family", e.target.value)}><option value="Arial, sans-serif">Arial</option><option value="Verdana, sans-serif">Verdana</option><option value="Trebuchet MS, sans-serif">Trebuchet MS</option><option value="Georgia, serif">Georgia</option><option value="system-ui, sans-serif">System UI</option></select></label>
    </div>
  </>;
}

function ColorsTab({ settings, updateSetting }: { settings: WheelSettings; updateSetting: <K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) => void }) {
  return <>
    <div className="section-head"><span className="section-badge">02 · Visual identity</span><h2>General Colors</h2><p>Fine-tune the main colors used across the wheel and customer interface.</p></div>
    <div className="color-grid">
      <div className="color-box"><ColorField label="Page Background" value={settings.page_background_color} onChange={value => updateSetting("page_background_color", value)} /></div>
      <div className="color-box"><ColorField label="Button Color" value={settings.button_color} onChange={value => updateSetting("button_color", value)} /></div>
      <div className="color-box"><ColorField label="Button Text Color" value={settings.button_text_color} onChange={value => updateSetting("button_text_color", value)} /></div>
      <div className="color-box"><ColorField label="Pointer Color" value={settings.pointer_color} onChange={value => updateSetting("pointer_color", value)} /></div>
      <div className="color-box"><ColorField label="Wheel Center Color" value={settings.center_color} onChange={value => updateSetting("center_color", value)} /></div>
      <div className="color-box"><ColorField label="Wheel Text Color" value={settings.text_color} onChange={value => updateSetting("text_color", value)} /></div>
    </div>
  </>;
}

function SegmentsTab({ prizes, getPrizeColor, updatePrizeColor }: { prizes: Prize[]; getPrizeColor: (prize: Prize, index: number) => string; updatePrizeColor: (id: string, color: string) => void }) {
  const activeCount = prizes.filter(prize => prize.active).length;
  return <>
    <div className="section-head"><span className="section-badge">03 · Prize design</span><h2>Wheel Segments <span className="segment-count">{activeCount} active</span></h2><p>Each prize has its own color. New prizes are picked up automatically and can have a custom color.</p></div>
    {prizes.length === 0 ? <div className="empty">No prizes found. Add prizes from Prize Management first.</div> : <div className="segment-list">{prizes.map((prize, index) => <div className={`segment-row ${!prize.active ? "inactive" : ""}`} key={prize.id}>
      <div className="segment-number">{index + 1}</div><div className="segment-name"><strong>{prize.name}</strong><small>{prize.active ? "● Active on customer wheel" : "Inactive — not shown on wheel"}</small></div>
      <ColorField compact label="Segment color" value={getPrizeColor(prize, index)} onChange={value => updatePrizeColor(prize.id, value)} />
    </div>)}</div>}
  </>;
}

function AnimationTab({ settings, updateSetting }: { settings: WheelSettings; updateSetting: <K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) => void }) {
  return <>
    <div className="section-head"><span className="section-badge">04 · Motion</span><h2>Animation</h2><p>Choose how long the wheel takes to complete its spin. A longer duration creates a slower, more dramatic reveal.</p></div>
    <div className="range-wrap">
      <div className="range-value"><span>Spin Animation Duration</span><b>{settings.animation_duration.toFixed(1)}s</b></div>
      <input type="range" min="1" max="10" step="0.1" value={settings.animation_duration} onChange={e => updateSetting("animation_duration", Number(e.target.value))} />
      <div className="animation-options">
        {[{v:2.5,l:"Fast"},{v:5.2,l:"Balanced"},{v:8,l:"Dramatic"}].map(option => <button type="button" key={option.v} className="animation-chip" onClick={() => updateSetting("animation_duration", option.v)}>{option.l}<br /><small>{option.v.toFixed(1)} sec</small></button>)}
      </div>
    </div>
    <div className="empty" style={{marginTop:16}}>Tip: 4–6 seconds gives the wheel a noticeable spin while keeping the experience quick for customers.</div>
  </>;
}

function ColorField({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean }) {
  return <div className={`color-row ${compact ? "compact" : ""}`}><label>{label}<input value={value} onChange={e => onChange(e.target.value)} maxLength={7} placeholder="#000000" /></label><input className="color-picker" type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={e => onChange(e.target.value)} aria-label={`${label} color picker`} /></div>;
}
