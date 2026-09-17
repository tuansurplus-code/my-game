"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

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
};

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
};

export default function WheelAppearancePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [settings, setSettings] = useState<WheelSettings>(defaults);
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
    await loadSettings();
  }

  async function loadSettings() {
    setError("");
    const { data, error } = await supabase.from("wheel_settings").select("id,title,subtitle,button_text,page_background_color,button_color,button_text_color,pointer_color,center_color,text_color,logo_url,font_family,animation_duration").eq("id", 1).maybeSingle();
    if (error) { console.error(error); setError("Unable to load wheel appearance settings."); return; }
    if (data) {
      setSettings({ ...defaults, ...data, logo_url: data.logo_url || "", animation_duration: Number(data.animation_duration) || 5.2 });
    }
  }

  function updateSetting<K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage(""); setError("");
    const duration = Number(settings.animation_duration);
    if (!Number.isFinite(duration) || duration < 1 || duration > 10) {
      setError("Animation duration must be between 1 and 10 seconds."); setSaving(false); return;
    }
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
      logo_url: settings.logo_url.trim() || null,
      font_family: settings.font_family,
      animation_duration: duration,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("wheel_settings").update(payload).eq("id", 1);
    if (error) { console.error(error); setError(error.message || "Unable to save appearance settings."); setSaving(false); return; }
    setSettings((current) => ({ ...current, ...payload, logo_url: payload.logo_url || "", animation_duration: duration }));
    setMessage("Wheel appearance settings saved successfully.");
    setSaving(false);
  }

  function resetDefaults() {
    if (!window.confirm("Reset the wheel appearance settings to the default design?")) return;
    setSettings(defaults); setMessage(""); setError("");
  }

  async function logout() { await supabase.auth.signOut(); router.replace("/admin/login"); }

  if (checking) return <main className="page loading-page"><div className="loading-card">Checking admin access...</div></main>;

  return (
    <main className="page" style={{ background: settings.page_background_color }}>
      <div className="topbar"><div><div className="brand">SINGHAGIRI</div><div className="brand-sub">SPIN & WIN ADMIN</div></div><div className="top-actions"><button onClick={() => router.push("/admin")}>← Dashboard</button><button onClick={logout}>Logout</button></div></div>
      <div className="content">
        <div className="heading"><div><h1>Wheel Appearance</h1><p>Manage the customer-facing Spin & Win appearance.</p></div></div>
        {message && <div className="success">✓ {message}</div>}
        {error && <div className="error">! {error}</div>}
        <form onSubmit={saveSettings} className="layout">
          <section className="card settings-card">
            <div className="card-title">Basic Content</div>
            <label>Wheel Title<input value={settings.title} onChange={(e) => updateSetting("title", e.target.value)} maxLength={40} /></label>
            <label>Subtitle<input value={settings.subtitle} onChange={(e) => updateSetting("subtitle", e.target.value)} maxLength={100} /></label>
            <label>Spin Button Text<input value={settings.button_text} onChange={(e) => updateSetting("button_text", e.target.value)} maxLength={25} /></label>
            <label>Logo URL<input type="url" placeholder="https://..." value={settings.logo_url || ""} onChange={(e) => updateSetting("logo_url", e.target.value)} /><small>Logo upload will be added in the next appearance stage.</small></label>
            <label>Font Family<select value={settings.font_family} onChange={(e) => updateSetting("font_family", e.target.value)}><option value="Arial, sans-serif">Arial</option><option value="Verdana, sans-serif">Verdana</option><option value="Trebuchet MS, sans-serif">Trebuchet MS</option><option value="Georgia, serif">Georgia</option><option value="system-ui, sans-serif">System UI</option></select></label>
            <div className="card-title spacing">Colors</div>
            <ColorField label="Page Background" value={settings.page_background_color} onChange={(value) => updateSetting("page_background_color", value)} />
            <ColorField label="Button Color" value={settings.button_color} onChange={(value) => updateSetting("button_color", value)} />
            <ColorField label="Button Text Color" value={settings.button_text_color} onChange={(value) => updateSetting("button_text_color", value)} />
            <ColorField label="Pointer Color" value={settings.pointer_color} onChange={(value) => updateSetting("pointer_color", value)} />
            <ColorField label="Wheel Center Color" value={settings.center_color} onChange={(value) => updateSetting("center_color", value)} />
            <ColorField label="Wheel Text Color" value={settings.text_color} onChange={(value) => updateSetting("text_color", value)} />
            <div className="card-title spacing">Animation</div>
            <label>Spin Animation Duration: {settings.animation_duration.toFixed(1)} seconds<input type="range" min="1" max="10" step="0.1" value={settings.animation_duration} onChange={(e) => updateSetting("animation_duration", Number(e.target.value))} /></label>
            <div className="form-actions"><button type="button" className="secondary" onClick={resetDefaults} disabled={saving}>Reset Form</button><button type="submit" className="primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button></div>
          </section>
          <section className="card preview-card">
            <div className="card-title">Current Preview</div>
            <div className="preview" style={{ fontFamily: settings.font_family }}>
              {settings.logo_url && <img className="preview-logo" src={settings.logo_url || ""} alt="Singhagiri logo" />}
              <div className="preview-title">{settings.title}</div><div className="preview-subtitle">{settings.subtitle}</div>
              <div className="mini-wheel"><div className="mini-pointer" style={{ color: settings.pointer_color }}>▼</div><div className="mini-segments"><span /><span /><span /><span /><span /><span /></div><div className="mini-center" style={{ background: settings.center_color }}><strong style={{ color: settings.text_color }}>SPIN</strong><small style={{ color: settings.text_color }}>& WIN</small></div></div>
              <button type="button" className="preview-button" style={{ background: settings.button_color, color: settings.button_text_color }}>{settings.button_text}</button>
            </div>
            <div className="preview-note">This preview shows the appearance settings. The actual prize wheel will use these settings after Stage 4B is connected.</div>
          </section>
        </form>
      </div>
      <style jsx>{`
        * { box-sizing: border-box; }
        .page { min-height: 100vh; color: #222; }
        .topbar { min-height: 76px; padding: 16px 28px; display: flex; align-items: center; justify-content: space-between; background: #111; color: white; }
        .brand { font-size: 18px; font-weight: 900; letter-spacing: .08em; }
        .brand-sub { margin-top: 3px; font-size: 9px; font-weight: 800; opacity: .65; letter-spacing: .14em; }
        .top-actions { display: flex; gap: 8px; }
        .top-actions button { border: 1px solid #444; background: #1d1d1d; color: white; border-radius: 8px; padding: 9px 12px; font-size: 11px; font-weight: 800; cursor: pointer; }
        .content { max-width: 1180px; margin: 0 auto; padding: 30px 22px 50px; }
        .heading h1 { margin: 0; font-size: 28px; }
        .heading p { margin: 6px 0 0; color: #777; font-size: 13px; }
        .success, .error { margin-top: 18px; padding: 12px 14px; border-radius: 9px; font-size: 12px; font-weight: 700; }
        .success { background: #eaf8ef; color: #19703a; }
        .error { background: #fff0f0; color: #a51d2d; }
        .layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); gap: 20px; margin-top: 22px; align-items: start; }
        .card { background: white; border: 1px solid #e4e4e4; border-radius: 14px; box-shadow: 0 5px 20px rgba(0,0,0,.05); padding: 22px; }
        .card-title { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 18px; }
        .spacing { margin-top: 28px; }
        label { display: block; margin-bottom: 15px; font-size: 11px; font-weight: 900; color: #444; }
        input, select { width: 100%; margin-top: 7px; padding: 11px 12px; border: 1px solid #d8d8d8; border-radius: 8px; background: white; color: #222; font: inherit; font-size: 12px; outline: none; }
        input:focus, select:focus { border-color: #999; }
        small { display: block; margin-top: 5px; color: #999; font-weight: 500; }
        input[type="range"] { padding: 0; accent-color: #e31b23; }
        .color-row { display: grid; grid-template-columns: 1fr 54px; gap: 10px; align-items: end; margin-bottom: 13px; }
        .color-row label { margin: 0; }
        .color-picker { width: 54px; height: 38px; padding: 3px; cursor: pointer; }
        .form-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 28px; }
        .form-actions button { border: 0; border-radius: 8px; padding: 11px 16px; font-size: 11px; font-weight: 900; cursor: pointer; }
        .primary { background: #e31b23; color: white; }
        .secondary { background: #eee; color: #333; }
        button:disabled { opacity: .55; cursor: not-allowed; }
        .preview-card { position: sticky; top: 20px; }
        .preview { min-height: 540px; border-radius: 12px; padding: 30px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fafafa; text-align: center; }
        .preview-logo { max-width: 150px; max-height: 55px; object-fit: contain; margin-bottom: 12px; }
        .preview-title { font-size: 26px; font-weight: 950; letter-spacing: .05em; }
        .preview-subtitle { margin-top: 6px; color: #777; font-size: 11px; }
        .mini-wheel { position: relative; width: 230px; height: 230px; margin: 30px 0 25px; }
        .mini-segments { width: 100%; height: 100%; border-radius: 50%; border: 7px solid #222; overflow: hidden; background: conic-gradient(#e31b23 0 16.66%, #f4b400 16.66% 33.32%, #1583d8 33.32% 49.98%, #18a05e 49.98% 66.64%, #7139a5 66.64% 83.30%, #e36c19 83.30% 100%); box-shadow: 0 10px 18px rgba(0,0,0,.18); }
        .mini-segments span { position: absolute; inset: 0; }
        .mini-pointer { position: absolute; z-index: 3; top: -18px; left: 50%; transform: translateX(-50%); font-size: 34px; font-weight: 900; text-shadow: 0 2px 4px rgba(0,0,0,.2); }
        .mini-center { position: absolute; z-index: 4; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 68px; height: 68px; border: 5px solid white; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,.2); }
        .mini-center strong { font-size: 12px; line-height: 12px; }
        .mini-center small { margin: 0; color: inherit; font-size: 8px; line-height: 10px; }
        .preview-button { border: 0; border-radius: 9px; padding: 13px 28px; font-size: 12px; font-weight: 900; cursor: default; }
        .preview-note { margin-top: 15px; color: #888; font-size: 10px; line-height: 1.5; }
        .loading-page { display: flex; align-items: center; justify-content: center; background: #f5f5f5; }
        .loading-card { background: white; padding: 25px; border-radius: 12px; font-weight: 800; }
        @media (max-width: 800px) { .layout { grid-template-columns: 1fr; } .preview-card { position: static; } }
        @media (max-width: 600px) { .topbar { padding: 14px 16px; } .top-actions button { padding: 8px 9px; } .content { padding: 22px 14px 40px; } .heading h1 { font-size: 23px; } .card { padding: 17px; } .form-actions { flex-direction: column-reverse; } .form-actions button { width: 100%; } }
      `}</style>
    </main>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void; }) {
  return (
    <div className="color-row">
      <label>{label}<input value={value} onChange={(e) => onChange(e.target.value)} maxLength={20} placeholder="#ffffff" /></label>
      <input className="color-picker" type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} aria-label={`${label} color picker`} />
    </div>
  );
}
