"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Prize = { id: string; name: string; active: boolean; sort_order: number };
type Tab = "branding" | "colors" | "segments" | "animation";
type WheelSettings = {
  id: number;
  title: string;
  subtitle: string;
  button_text: string;
  page_background_color: string;
  button_color: string;
  button_text_color: string;
  pointer_color: string;
  center_color: string;
  text_color: string;
  logo_url: string | null;
  font_family: string;
  animation_duration: number;
  header_text: string;
  online_text: string;
  segment_colors: Record<string, string>;
};

const palette = ["#e31b23", "#f4b400", "#1583d8", "#18a05e", "#7139a5", "#e36c19", "#008b8b", "#d63384", "#6f42c1", "#495057"];
const defaults: WheelSettings = {
  id: 1,
  title: "SPIN & WIN",
  subtitle: "Spin daily and win exciting rewards!",
  button_text: "SPIN NOW",
  page_background_color: "#ffffff",
  button_color: "#e31b23",
  button_text_color: "#ffffff",
  pointer_color: "#e31b23",
  center_color: "#e31b23",
  text_color: "#ffffff",
  logo_url: "",
  font_family: "Arial, sans-serif",
  animation_duration: 5.2,
  header_text: "SINGHAGIRI",
  online_text: "SINGHAGIRI ONLINE",
  segment_colors: {},
};

const selectFields = "id,title,subtitle,button_text,page_background_color,button_color,button_text_color,pointer_color,center_color,text_color,logo_url,font_family,animation_duration,header_text,online_text,segment_colors";
const tabs: { id: Tab; label: string; icon: string; description: string }[] = [
  { id: "branding", label: "Branding", icon: "✦", description: "Logo, text and typography" },
  { id: "colors", label: "Colors", icon: "◈", description: "Page, button and wheel colors" },
  { id: "segments", label: "Segments", icon: "◉", description: "Prize segment colors" },
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
    setChecking(false);
    await Promise.all([loadSettings(), loadPrizes()]);
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
    setSettings(current => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  function getPrizeColor(prize: Prize, index: number) {
    return settings.segment_colors[prize.id] || palette[index % palette.length];
  }

  function updatePrizeColor(prizeId: string, color: string) {
    setSettings(current => ({ ...current, segment_colors: { ...current.segment_colors, [prizeId]: color } }));
    setMessage("");
    setError("");
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const duration = Number(settings.animation_duration);
    if (!Number.isFinite(duration) || duration < 1 || duration > 10) {
      setError("Animation duration must be between 1 and 10 seconds.");
      setSaving(false);
      return;
    }

    const normalizedColors: Record<string, string> = { ...settings.segment_colors };
    prizes.forEach((prize, index) => {
      if (!normalizedColors[prize.id]) normalizedColors[prize.id] = palette[index % palette.length];
    });

    const payload = {
      title: settings.title.trim() || "SPIN & WIN",
      subtitle: settings.subtitle.trim() || "Spin daily and win exciting rewards!",
      button_text: settings.button_text.trim() || "SPIN NOW",
      page_background_color: settings.page_background_color,
      button_color: settings.button_color,
      button_text_color: settings.button_text_color,
      pointer_color: settings.pointer_color,
      center_color: settings.center_color,
      text_color: settings.text_color,
      logo_url: settings.logo_url?.trim() || null,
      font_family: settings.font_family,
      animation_duration: duration,
      header_text: settings.header_text.trim() || "SINGHAGIRI",
      online_text: settings.online_text.trim() || "SINGHAGIRI ONLINE",
      segment_colors: normalizedColors,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("wheel_settings").update(payload).eq("id", 1);
    if (error) {
      console.error(error);
      setError(error.message || "Unable to save appearance settings.");
      setSaving(false);
      return;
    }

    setSettings(current => ({ ...current, ...payload, logo_url: payload.logo_url || "", animation_duration: duration, segment_colors: normalizedColors }));
    setMessage("Wheel appearance settings saved successfully.");
    setSaving(false);
  }

  function resetDefaults() {
    if (!window.confirm("Reset the wheel appearance form to the default design?")) return;
    const resetColors: Record<string, string> = {};
    prizes.forEach((prize, index) => { resetColors[prize.id] = palette[index % palette.length]; });
    setSettings({ ...defaults, segment_colors: resetColors });
    setMessage("");
    setError("");
    setActiveTab("branding");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  if (checking) return <main className="page loading-page"><div className="loading-card">Checking admin access...</div></main>;

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand-wrap">
            <div className="brand-mark">S</div>
            <div><div className="brand">SINGHAGIRI</div><div className="brand-sub">SPIN & WIN ADMIN</div></div>
          </div>
          <div className="top-actions">
            <button type="button" onClick={() => router.push("/admin")}>← Dashboard</button>
            <button type="button" onClick={logout}>Logout</button>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="heading-row">
          <div>
            <div className="eyebrow">CUSTOMIZATION</div>
            <h1>Wheel Appearance</h1>
            <p>Customize your Spin & Win experience.</p>
          </div>
          <div className="status-pill"><span /> Live configuration</div>
        </div>

        {message && <div className="alert success">✓ <span>{message}</span></div>}
        {error && <div className="alert error">! <span>{error}</span></div>}

        <form onSubmit={saveSettings}>
          <section className="card appearance-card">
            <div className="tabs" role="tablist" aria-label="Wheel appearance sections">
              {tabs.map(tab => (
                <button key={tab.id} type="button" className={`tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => { setActiveTab(tab.id); setMessage(""); setError(""); }} role="tab" aria-selected={activeTab === tab.id}>
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-copy"><strong>{tab.label}</strong><small>{tab.description}</small></span>
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
                <button type="submit" className="primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}<b>→</b></button>
              </div>
            </div>
          </section>
        </form>
      </div>

      <style jsx>{`
        *{box-sizing:border-box}.page{min-height:100vh;background:linear-gradient(145deg,#f6f7f9,#eef1f5);color:#17191d}.topbar{height:78px;background:#101114;color:#fff;box-shadow:0 2px 14px rgba(0,0,0,.16)}.topbar-inner{height:100%;max-width:1240px;margin:auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between}.brand-wrap{display:flex;align-items:center;gap:11px}.brand-mark{width:35px;height:35px;border-radius:10px;background:#e31b23;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:950;box-shadow:0 5px 14px rgba(227,27,35,.3)}.brand{font-size:16px;font-weight:950;letter-spacing:.12em}.brand-sub{margin-top:3px;font-size:8px;font-weight:800;letter-spacing:.16em;opacity:.55}.top-actions{display:flex;gap:8px}.top-actions button{border:1px solid #34363b;background:#1b1d21;color:#fff;border-radius:9px;padding:9px 13px;font-size:11px;font-weight:800;cursor:pointer}.top-actions button:hover{background:#292b30}.content{max-width:1240px;margin:auto;padding:32px 24px 55px}.heading-row{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.eyebrow{font-size:9px;font-weight:950;letter-spacing:.16em;color:#e31b23;margin-bottom:6px}.heading-row h1{margin:0;font-size:30px;letter-spacing:-.035em}.heading-row p{margin:7px 0 0;color:#777;font-size:13px}.status-pill{display:flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid #dfe3e8;border-radius:999px;background:#fff;font-size:10px;font-weight:800;color:#666}.status-pill span{width:7px;height:7px;border-radius:50%;background:#18a05e;box-shadow:0 0 0 3px rgba(24,160,94,.12)}.alert{margin-top:18px;padding:12px 15px;border-radius:11px;display:flex;gap:9px;align-items:center;font-size:12px;font-weight:800}.success{background:#eaf8ef;border:1px solid #c9ecd5;color:#19703a}.error{background:#fff0f0;border:1px solid #f1c8cd;color:#a51d2d}.appearance-card{margin-top:24px;overflow:hidden;background:rgba(255,255,255,.96);border:1px solid #e1e5e9;border-radius:17px;box-shadow:0 12px 35px rgba(26,34,46,.07)}.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-bottom:1px solid #e4e7eb;background:#f7f8fa;padding:10px}.tab{position:relative;border:1px solid transparent;background:transparent;text-align:left;display:flex;align-items:center;justify-content:center;gap:10px;min-height:70px;padding:12px 16px;border-radius:11px;color:#70757d;cursor:pointer;transition:.18s}.tab:hover{background:#eceff2;color:#282b30}.tab.active{background:#fff;color:#17191d;border-color:#e4e6e9;box-shadow:0 5px 16px rgba(22,28,35,.07)}.tab.active:after{content:"";position:absolute;left:18%;right:18%;bottom:-11px;height:3px;border-radius:3px;background:#e31b23}.tab-icon{width:34px;height:34px;flex:none;border-radius:9px;background:#eef0f3;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900}.tab.active .tab-icon{background:#fff0f1;color:#e31b23}.tab-copy{display:flex;flex-direction:column;gap:3px;min-width:0}.tab-copy strong{font-size:12px;font-weight:900;white-space:nowrap}.tab-copy small{font-size:9px;color:#90959d;white-space:nowrap}.editor-body{padding:30px 34px 26px;min-height:580px}.section-head{margin-bottom:22px}.section-head .kicker{font-size:9px;font-weight:950;letter-spacing:.15em;color:#e31b23}.section-head h2{margin:5px 0 0;font-size:21px;letter-spacing:-.02em}.section-head p{margin:6px 0 0;font-size:12px;color:#777}.settings-section{margin-bottom:26px}.settings-section h3{margin:0 0 12px;font-size:13px;font-weight:900}.settings-box{border:1px solid #e4e7eb;border-radius:13px;background:#fbfcfd;padding:18px}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 20px}.field{display:flex;flex-direction:column;gap:7px}.field.full{grid-column:1/-1}.field label{font-size:10px;font-weight:850;color:#555b63}.field input,.field select{width:100%;height:42px;border:1px solid #dfe3e8;border-radius:9px;background:#fff;padding:0 12px;font-size:12px;color:#17191d;outline:none}.field input:focus,.field select:focus{border-color:#e31b23;box-shadow:0 0 0 3px rgba(227,27,35,.08)}.color-field{display:flex;gap:8px}.color-field input[type=color]{width:46px;height:42px;padding:3px;border:1px solid #dfe3e8;border-radius:9px;background:#fff;cursor:pointer}.color-field input[type=text]{flex:1}.helper{margin:5px 0 0;font-size:10px;color:#92969c}.segment-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.segment-row{display:flex;align-items:center;gap:12px;border:1px solid #e4e7eb;background:#fff;border-radius:11px;padding:12px}.segment-number{width:28px;height:28px;border-radius:8px;background:#f1f3f5;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#666}.segment-info{flex:1;min-width:0}.segment-info strong{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.segment-info small{display:block;margin-top:3px;font-size:9px;color:#92969c}.segment-color{display:flex;align-items:center;gap:7px}.segment-color input[type=color]{width:36px;height:36px;padding:2px;border:1px solid #dfe3e8;border-radius:8px;cursor:pointer}.segment-color code{font-size:9px;color:#777}.empty-state{border:1px dashed #d8dce1;border-radius:12px;padding:28px;text-align:center;color:#858a91;font-size:11px}.range-wrap{display:flex;align-items:center;gap:15px}.range-wrap input[type=range]{flex:1;accent-color:#e31b23}.range-value{min-width:64px;text-align:center;border:1px solid #dfe3e8;border-radius:8px;background:#fff;padding:9px;font-size:11px;font-weight:900}.form-footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e7e9ec;margin-top:30px;padding-top:22px}.secondary,.primary{border-radius:9px;padding:11px 16px;font-size:11px;font-weight:850;cursor:pointer}.secondary{border:1px solid #d9dde2;background:#fff;color:#555}.secondary:hover{background:#f6f7f8}.primary{border:0;background:#e31b23;color:#fff;display:flex;align-items:center;gap:18px;box-shadow:0 7px 18px rgba(227,27,35,.2)}.primary:hover{background:#c91820}.primary:disabled,.secondary:disabled{opacity:.55;cursor:not-allowed}.primary b{font-size:15px}.loading-page{display:flex;align-items:center;justify-content:center;background:#f5f6f8}.loading-card{background:#fff;border:1px solid #e1e5e9;border-radius:14px;padding:22px 28px;font-size:12px;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.06)}
        @media(max-width:800px){.content{padding:24px 16px 40px}.topbar-inner{padding:0 16px}.heading-row{align-items:flex-start;flex-direction:column}.status-pill{display:none}.tabs{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.tab{justify-content:flex-start;min-height:62px;padding:10px}.tab.active:after{left:10%;right:10%;bottom:-7px}.tab-copy small{display:none}.editor-body{padding:24px 18px}.field-grid,.segment-list{grid-template-columns:1fr}.field.full{grid-column:auto}.form-footer{gap:10px}.secondary,.primary{flex:1;justify-content:center}}
        @media(max-width:480px){.brand-sub{display:none}.brand{font-size:13px}.top-actions button{padding:8px 9px}.heading-row h1{font-size:25px}.tab-icon{width:30px;height:30px}.tab-copy strong{font-size:10px}.editor-body{padding:20px 14px}.settings-box{padding:13px}}
      `}</style>
    </main>
  );
}

function BrandingTab({ settings, updateSetting }: { settings: WheelSettings; updateSetting: <K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) => void }) {
  return <>
    <div className="section-head"><div className="kicker">BRANDING & CONTENT</div><h2>Branding & Content</h2><p>Control the brand identity and customer-facing text on the wheel.</p></div>
    <div className="settings-section"><h3>Brand Identity</h3><div className="settings-box"><div className="field-grid">
      <div className="field full"><label>Logo URL</label><input value={settings.logo_url || ""} onChange={e => updateSetting("logo_url", e.target.value)} placeholder="https://..." /><p className="helper">Enter the public URL of your logo image.</p></div>
      <div className="field"><label>Header Brand Text</label><input value={settings.header_text} onChange={e => updateSetting("header_text", e.target.value)} placeholder="SINGHAGIRI" /></div>
      <div className="field"><label>Online Brand Text</label><input value={settings.online_text} onChange={e => updateSetting("online_text", e.target.value)} placeholder="SINGHAGIRI ONLINE" /></div>
      <div className="field full"><label>Font Family</label><select value={settings.font_family} onChange={e => updateSetting("font_family", e.target.value)}><option value="Arial, sans-serif">Arial</option><option value="Inter, sans-serif">Inter</option><option value="Roboto, sans-serif">Roboto</option><option value="Georgia, serif">Georgia</option><option value="Verdana, sans-serif">Verdana</option></select></div>
    </div></div></div>
    <div className="settings-section"><h3>Wheel Content</h3><div className="settings-box"><div className="field-grid">
      <div className="field"><label>Wheel Title</label><input value={settings.title} onChange={e => updateSetting("title", e.target.value)} /></div>
      <div className="field"><label>Button Text</label><input value={settings.button_text} onChange={e => updateSetting("button_text", e.target.value)} /></div>
      <div className="field full"><label>Subtitle</label><input value={settings.subtitle} onChange={e => updateSetting("subtitle", e.target.value)} /></div>
    </div></div></div>
  </>;
}

function ColorsTab({ settings, updateSetting }: { settings: WheelSettings; updateSetting: <K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) => void }) {
  const color = (label: string, key: keyof WheelSettings) => <div className="field"><label>{label}</label><div className="color-field"><input type="color" value={String(settings[key])} onChange={e => updateSetting(key, e.target.value as never)} /><input type="text" value={String(settings[key])} onChange={e => updateSetting(key, e.target.value as never)} /></div></div>;
  return <>
    <div className="section-head"><div className="kicker">GENERAL COLORS</div><h2>General Colors</h2><p>Configure the main colors used across the Spin & Win experience.</p></div>
    <div className="settings-section"><h3>Page & Button</h3><div className="settings-box"><div className="field-grid">
      {color("Page Background Color", "page_background_color")}{color("Button Color", "button_color")}{color("Button Text Color", "button_text_color")}
    </div></div></div>
    <div className="settings-section"><h3>Wheel</h3><div className="settings-box"><div className="field-grid">
      {color("Pointer Color", "pointer_color")}{color("Center Color", "center_color")}{color("Wheel Text Color", "text_color")}
    </div></div></div>
  </>;
}

function SegmentsTab({ prizes, getPrizeColor, updatePrizeColor }: { prizes: Prize[]; getPrizeColor: (prize: Prize, index: number) => string; updatePrizeColor: (id: string, color: string) => void }) {
  const activePrizes = prizes.filter(prize => prize.active);
  return <>
    <div className="section-head"><div className="kicker">WHEEL SEGMENTS</div><h2>Wheel Segments</h2><p>Choose the color displayed for each active prize segment.</p></div>
    <div className="settings-section"><h3>Prize Colors</h3><div className="settings-box">
      {activePrizes.length === 0 ? <div className="empty-state">No active prizes are available. Activate a prize in Prize Management first.</div> : <div className="segment-list">{activePrizes.map((prize, index) => { const value = getPrizeColor(prize, index); return <div className="segment-row" key={prize.id}><div className="segment-number">{index + 1}</div><div className="segment-info"><strong>{prize.name}</strong><small>Active prize segment</small></div><div className="segment-color"><input type="color" value={value} onChange={e => updatePrizeColor(prize.id, e.target.value)} /><code>{value.toUpperCase()}</code></div></div>; })}</div>}
    </div></div>
  </>;
}

function AnimationTab({ settings, updateSetting }: { settings: WheelSettings; updateSetting: <K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) => void }) {
  return <>
    <div className="section-head"><div className="kicker">ANIMATION</div><h2>Animation</h2><p>Control how long the wheel spins before showing the result.</p></div>
    <div className="settings-section"><h3>Spin Duration</h3><div className="settings-box"><div className="field">
      <label>Animation Duration</label>
      <div className="range-wrap"><input type="range" min="1" max="10" step="0.1" value={settings.animation_duration} onChange={e => updateSetting("animation_duration", Number(e.target.value))} /><div className="range-value">{Number(settings.animation_duration).toFixed(1)} sec</div></div>
      <p className="helper">Choose a duration between 1 and 10 seconds.</p>
    </div></div></div>
  </>;
}
