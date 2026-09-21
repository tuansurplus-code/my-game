"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

const palette = [
  "#AF181D",
  "#D6B24C",
  "#1B6AA7",
  "#1F8E59",
  "#7A34BC",
  "#E36C19",
  "#008B8B",
  "#D63384",
  "#6F42C1",
  "#495057",
];

const defaults: WheelSettings = {
  id: 1,
  title: "SPIN & WIN",
  subtitle: "Spin daily and win exciting rewards!",
  button_text: "SPIN NOW",
  page_background_color: "#9dbbe1",
  button_color: "#321be4",
  button_text_color: "#ffffff",
  pointer_color: "#050505",
  center_color: "#1e1be4",
  text_color: "#ffffff",
  logo_url: "https://www.singhagiri.lk/assets/images/logo.png",
  font_family: "Inter, sans-serif",
  animation_duration: 6,
  header_text: "SINGHAGIRI",
  online_text: "SINGHAGIRI ONLINE",
  segment_colors: {},
};

const selectFields =
  "id,title,subtitle,button_text,page_background_color,button_color,button_text_color,pointer_color,center_color,text_color,logo_url,font_family,animation_duration,header_text,online_text,segment_colors";

const tabs: { id: Tab; label: string; icon: string; description: string }[] = [
  { id: "branding", label: "Branding", icon: "✦", description: "Logo, font & titles" },
  { id: "colors", label: "Colors", icon: "◈", description: "Palette & buttons" },
  { id: "segments", label: "Segments", icon: "◉", description: "Prizes & slices" },
  { id: "animation", label: "Animation", icon: "↻", description: "Duration & physics" },
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
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewSpinning, setPreviewSpinning] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      const withTimeout = <T,>(promise: PromiseLike<T>, timeoutMs = 10000): Promise<T> =>
        Promise.race([
          Promise.resolve(promise),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("Admin access check timed out.")), timeoutMs)
          ),
        ]);

      const {
        data: { session },
      } = await withTimeout(supabase.auth.getSession());

      if (!session?.user) {
        router.replace("/admin/login");
        return;
      }

      const { data: admin, error: adminError } = await withTimeout(
        supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle()
      );

      if (adminError || !admin) {
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      setChecking(false);
      await Promise.all([loadSettings(), loadPrizes()]);
    } catch (err) {
      console.error("Admin access check failed:", err);
      router.replace("/admin/login");
    }
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from("wheel_settings")
      .select(selectFields)
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error(error);
      setError("Unable to load wheel appearance settings.");
      return;
    }

    if (data) {
      const colors =
        data.segment_colors &&
        typeof data.segment_colors === "object" &&
        !Array.isArray(data.segment_colors)
          ? data.segment_colors
          : {};

      setSettings({
        ...defaults,
        ...data,
        logo_url: data.logo_url || defaults.logo_url,
        animation_duration: Number(data.animation_duration) || defaults.animation_duration,
        segment_colors: colors,
      });
    }
  }

  async function loadPrizes() {
    const { data, error } = await supabase
      .from("prizes")
      .select("id,name,active,sort_order")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error(error);
      setError("Unable to load prizes for wheel segments.");
      return;
    }

    setPrizes((data || []) as Prize[]);
  }

  function updateSetting<K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  function getPrizeColor(prize: Prize, index: number) {
    return settings.segment_colors[prize.id] || palette[index % palette.length];
  }

  function updatePrizeColor(prizeId: string, color: string) {
    setSettings((current) => ({
      ...current,
      segment_colors: { ...current.segment_colors, [prizeId]: color },
    }));
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
      if (!normalizedColors[prize.id]) {
        normalizedColors[prize.id] = palette[index % palette.length];
      }
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

    setSettings((current) => ({
      ...current,
      ...payload,
      logo_url: payload.logo_url || "",
      animation_duration: duration,
      segment_colors: normalizedColors,
    }));

    setMessage("Changes saved successfully.");
    setSaving(false);
  }

  function resetDefaults() {
    if (!window.confirm("Reset the wheel appearance form to the default design?")) return;

    const resetColors: Record<string, string> = {};
    prizes.forEach((prize, index) => {
      resetColors[prize.id] = palette[index % palette.length];
    });

    setSettings({ ...defaults, segment_colors: resetColors });
    setMessage("");
    setError("");
    setActiveTab("branding");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  function previewSpin() {
    if (previewSpinning || activePrizes.length === 0) return;

    const index = Math.floor(Math.random() * activePrizes.length);
    const count = activePrizes.length;
    const angle = 360 / count;
    const target = previewRotation + 360 * 6 + (360 - (index * angle + angle / 2));

    setPreviewSpinning(true);
    setPreviewRotation(target);

    window.setTimeout(() => {
      setPreviewSpinning(false);
    }, Math.max(1000, settings.animation_duration * 1000));
  }

  const activePrizes = prizes.filter((prize) => prize.active);

  const previewSegments = useMemo(
    () =>
      activePrizes.map((prize, index) => ({
        ...prize,
        color: getPrizeColor(prize, index),
      })),
    [activePrizes, settings.segment_colors]
  );

  if (checking) {
    return (
      <main className="loading-page">
        <div className="loading-card">Checking admin access...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="admin-header">
        <div className="header-inner">
          <div className="brand-group">
            <div className="brand-mark">S</div>
            <div>
              <div className="brand-name">SINGHAGIRI</div>
              <div className="brand-title">SPIN & WIN ADMIN</div>
            </div>
          </div>

          <div className="header-actions">
            <button type="button" onClick={() => router.push("/admin")} className="header-button">
              <span>▦</span> Dashboard
            </button>
            <button type="button" onClick={logout} className="header-button logout-button">
              <span>↪</span> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="page-content">
        <div className="page-heading">
          <div>
            <div className="heading-kicker">CUSTOMIZATION</div>
            <h1>Wheel Appearance</h1>
            <p>Customize your Spin & Win customer experience in real time.</p>
          </div>
          <div className="configuration-status">
            <i />
            Live configuration
          </div>
        </div>

        {message && (
          <div className="alert success-alert">
            <span>✓</span>
            {message}
          </div>
        )}
        {error && (
          <div className="alert error-alert">
            <span>!</span>
            {error}
          </div>
        )}

        <form onSubmit={saveSettings}>
          <div className="workspace">
            <section className="editor-card">
              <div className="tabs" role="tablist">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`tab ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMessage("");
                      setError("");
                    }}
                  >
                    <span className="tab-icon">{tab.icon}</span>
                    <span className="tab-copy">
                      <strong>{tab.label}</strong>
                      <small>{tab.description}</small>
                    </span>
                  </button>
                ))}
              </div>

              <div className="editor-body">
                {activeTab === "branding" && (
                  <BrandingTab settings={settings} updateSetting={updateSetting} />
                )}
                {activeTab === "colors" && (
                  <ColorsTab settings={settings} updateSetting={updateSetting} />
                )}
                {activeTab === "segments" && (
                  <SegmentsTab
                    prizes={prizes}
                    getPrizeColor={getPrizeColor}
                    updatePrizeColor={updatePrizeColor}
                    onManagePrizes={() => router.push("/admin/prizes")}
                  />
                )}
                {activeTab === "animation" && (
                  <AnimationTab settings={settings} updateSetting={updateSetting} />
                )}

                <div className="form-footer">
                  <button type="button" className="reset-button" onClick={resetDefaults} disabled={saving}>
                    ↻ <span>Reset to Default</span>
                  </button>
                  <button type="submit" className="save-button" disabled={saving}>
                    <span>{saving ? "Saving..." : "Save Changes"}</span>
                    <b>→</b>
                  </button>
                </div>
              </div>
            </section>

            <aside className="preview-column">
              <div className="preview-heading">
                <div>
                  <div className="preview-kicker">LIVE PREVIEW</div>
                  <h2>Customer View</h2>
                </div>
                <div className="preview-actions">
                  <button
                    type="button"
                    className="preview-open"
                    onClick={() => window.open("/", "_blank", "noopener,noreferrer")}
                  >
                    Preview ↗
                  </button>
                  <span className="live-badge">
                    <i />
                    Live
                  </span>
                </div>
              </div>
              <p className="preview-description">
                Live preview of the customer-facing Spin & Win experience.
              </p>

              <div className="preview-frame">
                <div className="browser-bar">
                  <div className="browser-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="browser-address">singhagiri.lk/spin</div>
                  <span className="browser-menu">•••</span>
                </div>

                <div
                  className="customer-preview"
                  style={{
                    backgroundColor: settings.page_background_color,
                    fontFamily: settings.font_family,
                  }}
                >
                  <div className="customer-brand-row">
                    <div className="customer-brand">{settings.header_text}</div>
                    <div className="customer-admin-label">SPIN & WIN</div>
                  </div>

                  {settings.logo_url ? (
                    <img
                      className="customer-logo"
                      src={settings.logo_url}
                      alt="Singhagiri logo"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}

                  <div className="customer-online">{settings.online_text}</div>
                  <div className="customer-title">{settings.title}</div>
                  <div className="customer-subtitle">{settings.subtitle}</div>

                  <div className="wheel-preview-wrap">
                    <div
                      className="preview-pointer"
                      style={{ borderTopColor: settings.pointer_color }}
                    />
                    <div
                      className="preview-wheel"
                      style={{
                        transform: `rotate(${previewRotation}deg)`,
                        transitionDuration: `${settings.animation_duration}s`,
                      }}
                    >
                      <PreviewWheelSvg
                        segments={previewSegments}
                        textColor={settings.text_color}
                      />
                    </div>
                    <div
                      className="preview-center"
                      style={{ backgroundColor: settings.center_color }}
                    >
                      <strong style={{ color: settings.text_color }}>SPIN</strong>
                      <small style={{ color: settings.text_color }}>& WIN</small>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="preview-spin-button"
                    style={{
                      backgroundColor: settings.button_color,
                      color: settings.button_text_color,
                    }}
                    onClick={previewSpin}
                    disabled={previewSpinning || activePrizes.length === 0}
                  >
                    {previewSpinning ? "SPINNING..." : settings.button_text}
                  </button>
                </div>
              </div>

              <div className="preview-stats">
                <div>
                  <b>{activePrizes.length}</b>
                  <span>Active Prizes</span>
                </div>
                <div>
                  <b>{Number(settings.animation_duration).toFixed(1)}s</b>
                  <span>Duration</span>
                </div>
                <div>
                  <b className="green-text">Active</b>
                  <span>Status</span>
                </div>
              </div>

              <p className="preview-note">
                Click <strong>SPIN NOW</strong> on the preview to test wheel physics.
              </p>
            </aside>
          </div>
        </form>
      </div>

      <style jsx>{`
        * { box-sizing: border-box; }
        .page {
          min-height: 100vh;
          background: #f8fafc;
          color: #1e293b;
        }
        .admin-header {
          height: 72px;
          background: #111827;
          color: #fff;
          box-shadow: 0 3px 12px rgba(15, 23, 42, .14);
        }
        .header-inner {
          max-width: 1600px;
          height: 100%;
          margin: 0 auto;
          padding: 0 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .brand-group { display:flex; align-items:center; gap:11px; }
        .brand-mark {
          width:35px; height:35px; border-radius:6px;
          display:flex; align-items:center; justify-content:center;
          background:#dc2626; color:#fff; font-size:19px; font-weight:950;
        }
        .brand-name { font-size:12px; font-weight:900; letter-spacing:.13em; color:#ef4444; }
        .brand-title { margin-top:2px; font-size:13px; font-weight:800; letter-spacing:.06em; color:#f8fafc; }
        .header-actions { display:flex; gap:9px; }
        .header-button {
          display:flex; align-items:center; gap:8px;
          border:1px solid #374151; background:#1f2937; color:#e5e7eb;
          border-radius:8px; padding:9px 13px; font-size:11px; font-weight:700; cursor:pointer;
        }
        .header-button:hover { background:#374151; }
        .logout-button { color:#fca5a5; border-color:#7f1d1d; }
        .page-content {
          max-width:1600px; width:100%; margin:0 auto;
          padding:30px 32px 52px;
        }
        .page-heading {
          display:flex; align-items:flex-end; justify-content:space-between; gap:20px;
          max-width:1460px; margin:0 auto;
        }
        .heading-kicker, .preview-kicker {
          color:#dc2626; font-size:10px; font-weight:900; letter-spacing:.15em; text-transform:uppercase;
        }
        .page-heading h1 { margin:4px 0 0; color:#0f172a; font-size:28px; line-height:1.1; font-weight:900; letter-spacing:-.025em; }
        .page-heading p { margin:7px 0 0; color:#64748b; font-size:12px; }
        .configuration-status {
          display:flex; align-items:center; gap:7px; background:#fff; border:1px solid #e2e8f0;
          border-radius:999px; padding:8px 12px; color:#64748b; font-size:10px; font-weight:700;
        }
        .configuration-status i, .live-badge i {
          width:7px; height:7px; border-radius:50%; background:#10b981;
          box-shadow:0 0 0 3px rgba(16,185,129,.12);
        }
        .alert { max-width:1460px; margin:18px auto 0; padding:11px 14px; border-radius:10px; display:flex; gap:8px; font-size:11px; font-weight:700; }
        .success-alert { background:#ecfdf5; border:1px solid #bbf7d0; color:#166534; }
        .error-alert { background:#fff1f2; border:1px solid #fecdd3; color:#9f1239; }
        .workspace {
          max-width:1460px; margin:38px auto 0;
          display:grid; grid-template-columns:minmax(0, 820px) minmax(390px, 1fr);
          gap:42px; align-items:start;
        }
        .editor-card, .preview-frame {
          background:#fff; border:1px solid #e2e8f0; border-radius:14px;
          box-shadow:0 8px 24px rgba(15,23,42,.055);
        }
        .editor-card { overflow:hidden; min-width:0; }
        .tabs {
          display:grid; grid-template-columns:repeat(4, minmax(0,1fr));
          gap:0; background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:8px;
        }
        .tab {
          position:relative; min-width:0; min-height:64px; border:1px solid transparent;
          border-radius:9px; background:transparent; padding:9px 11px;
          display:flex; align-items:center; gap:9px; text-align:left; color:#64748b; cursor:pointer;
        }
        .tab:hover { background:#f1f5f9; color:#0f172a; }
        .tab.active {
          background:#fff; border-color:#e2e8f0; color:#0f172a;
          box-shadow:0 2px 8px rgba(15,23,42,.05);
        }
        .tab.active:after {
          content:""; position:absolute; left:12px; right:12px; bottom:-9px;
          height:3px; border-radius:3px; background:#dc2626;
        }
        .tab-icon {
          width:31px; height:31px; flex:none; display:flex; align-items:center; justify-content:center;
          border-radius:8px; background:#f1f5f9; color:#64748b; font-size:15px; font-weight:900;
        }
        .tab.active .tab-icon { background:#fef2f2; color:#dc2626; }
        .tab-copy { min-width:0; display:flex; flex-direction:column; gap:3px; }
        .tab-copy strong { font-size:11px; font-weight:900; white-space:nowrap; }
        .tab-copy small { font-size:8px; line-height:1.2; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .editor-body { padding:27px 26px 24px; min-height:570px; }
        .section-head { margin-bottom:21px; }
        .section-head h2 { margin:4px 0 0; font-size:18px; line-height:1.2; font-weight:850; color:#0f172a; }
        .section-head p { margin:5px 0 0; color:#64748b; font-size:11px; }
        .settings-section { margin-bottom:23px; }
        .segment-section-title { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }\n        .segment-section-title h3 { margin:0; }\n        .settings-section > h3 {
          margin:0 0 10px; color:#334155; font-size:11px; font-weight:900;
        }
        .settings-box {
          padding:16px; border:1px solid #e2e8f0; border-radius:11px; background:#fbfcfd;
        }
        .field-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:15px 16px; }
        .field { min-width:0; display:flex; flex-direction:column; gap:6px; }
        .field.full { grid-column:1/-1; }
        .field label {
          color:#475569; font-size:9px; line-height:1.2; font-weight:800;
          text-transform:uppercase; letter-spacing:.06em;
        }
        .field input:not([type="color"]), .field select {
          width:100%; height:39px; padding:0 11px; border:1px solid #cbd5e1;
          border-radius:7px; background:#fff; color:#0f172a; outline:none;
          font-size:11px; font-weight:500;
        }
        .field input:focus, .field select:focus {
          border-color:#dc2626; box-shadow:0 0 0 3px rgba(220,38,38,.08);
        }
        .helper { margin:0; color:#94a3b8; font-size:9px; line-height:1.3; }
        .color-field { display:flex; align-items:center; gap:8px; }
        .color-field input[type="color"] {
          width:39px; height:39px; padding:3px; border:1px solid #cbd5e1;
          border-radius:7px; background:#fff; cursor:pointer;
        }
        .color-field input[type="text"] {
          flex:1; min-width:0; height:39px; padding:0 10px; border:1px solid #cbd5e1;
          border-radius:7px; background:#fff; font-size:10px; font-family:monospace;
          font-weight:700; text-transform:uppercase; color:#0f172a;
        }
        .segment-list { display:grid; grid-template-columns:1fr; gap:9px; }
        .segment-row {
          display:flex; align-items:center; gap:10px; padding:11px;
          border:1px solid #e2e8f0; border-radius:9px; background:#fff;
        }
        .segment-number {
          width:27px; height:27px; flex:none; border-radius:7px; background:#f1f5f9;
          display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:900; color:#64748b;
        }
        .segment-info { min-width:0; flex:1; }
        .segment-info strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#1e293b; font-size:11px; }
        .segment-info small { display:block; margin-top:2px; color:#94a3b8; font-size:9px; }
        .segment-color { display:flex; align-items:center; gap:7px; }
        .segment-color input[type="color"] {
          width:32px; height:32px; padding:2px; border:1px solid #cbd5e1;
          border-radius:7px; background:#fff; cursor:pointer;
        }
        .segment-color code { color:#64748b; font-size:8px; font-weight:700; }
        .manage-prizes {
          border:1px solid #cbd5e1; background:#fff; color:#475569; border-radius:7px;
          padding:7px 9px; font-size:9px; font-weight:800; cursor:pointer;
        }
        .empty-state { padding:25px; text-align:center; border:1px dashed #cbd5e1; border-radius:9px; color:#94a3b8; font-size:10px; }
        .animation-box { background:#f8fafc; }\n        .animation-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }\n        .animation-header span { color:#475569; font-size:9px; font-weight:900; letter-spacing:.06em; }\n        .animation-header strong { color:#dc2626; font-size:14px; font-weight:950; font-family:monospace; }\n        .range-wrap { display:flex; align-items:center; gap:13px; }
        .range-wrap input[type="range"] { flex:1; accent-color:#dc2626; }
        .range-labels { display:flex; justify-content:space-between; margin-top:7px; color:#94a3b8; font-size:8px; font-weight:700; }\n        .sound-row { margin-top:18px; padding:12px; display:flex; align-items:center; justify-content:space-between; gap:12px; background:#fff; border:1px solid #e2e8f0; border-radius:9px; }\n        .sound-row strong { display:block; color:#334155; font-size:10px; }\n        .sound-row p { margin:3px 0 0; color:#94a3b8; font-size:8px; }\n        .toggle-placeholder { border-radius:999px; padding:5px 8px; background:#ecfdf5; color:#047857; font-size:8px; font-weight:900; }\n        .range-value { min-width:65px; padding:9px 8px; text-align:center; border:1px solid #cbd5e1; border-radius:7px; background:#fff; color:#0f172a; font-size:10px; font-weight:900; }
        .form-footer {
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          margin-top:30px; padding-top:20px; border-top:1px solid #e2e8f0;
        }
        .reset-button, .save-button {
          display:flex; align-items:center; justify-content:center; gap:8px;
          border-radius:8px; padding:10px 15px; font-size:10px; font-weight:850; cursor:pointer;
        }
        .reset-button { border:1px solid #cbd5e1; background:#fff; color:#475569; }
        .reset-button:hover { background:#f8fafc; }
        .save-button {
          min-width:125px; border:0; background:#dc2626; color:#fff;
          box-shadow:0 6px 14px rgba(220,38,38,.18);
        }
        .save-button:hover { background:#b91c1c; }
        .reset-button:disabled, .save-button:disabled { opacity:.55; cursor:not-allowed; }
        .save-button b { font-size:14px; }
        .preview-column { min-width:0; position:sticky; top:18px; }
        .preview-heading {
          display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
        }
        .preview-heading h2 { margin:4px 0 0; font-size:19px; font-weight:850; color:#0f172a; }
        .preview-actions { display:flex; align-items:center; gap:7px; }
        .preview-open {
          border:1px solid #cbd5e1; background:#fff; color:#334155; border-radius:999px;
          padding:7px 10px; font-size:9px; font-weight:850; cursor:pointer;
        }
        .preview-open:hover { background:#f8fafc; }
        .live-badge {
          display:flex; align-items:center; gap:6px; border:1px solid #bbf7d0; background:#ecfdf5;
          color:#047857; border-radius:999px; padding:7px 10px; font-size:9px; font-weight:850;
        }
        .preview-description { margin:5px 0 13px; color:#64748b; font-size:10px; }
        .preview-frame { overflow:hidden; }
        .browser-bar {
          height:31px; padding:0 10px; display:flex; align-items:center; gap:7px;
          background:#eef2f7; border-bottom:1px solid #dbe2ea;
        }
        .browser-dots { display:flex; gap:4px; }
        .browser-dots span { width:7px; height:7px; border-radius:50%; background:#cbd5e1; }
        .browser-address {
          flex:1; height:18px; display:flex; align-items:center; justify-content:center;
          border:1px solid #dbe2ea; border-radius:5px; background:#fff; color:#94a3b8;
          font-size:8px; font-family:monospace;
        }
        .browser-menu { color:#94a3b8; font-size:9px; }
        .customer-preview {
          min-height:535px; padding:17px 18px 20px; display:flex; flex-direction:column;
          align-items:center; text-align:center; overflow:hidden;
        }
        .customer-brand-row {
          width:100%; display:flex; align-items:center; justify-content:space-between;
          margin-bottom:7px; color:#334155;
        }
        .customer-brand { font-size:10px; font-weight:900; letter-spacing:.08em; }
        .customer-admin-label { font-size:7px; font-weight:900; letter-spacing:.14em; opacity:.55; }
        .customer-logo { width:auto; max-width:135px; max-height:38px; object-fit:contain; margin:2px 0 6px; }
        .customer-online { color:#475569; font-size:8px; font-weight:900; letter-spacing:.13em; }
        .customer-title { margin-top:2px; color:#0f172a; font-size:25px; line-height:1.05; font-weight:950; letter-spacing:-.04em; }
        .customer-subtitle { margin-top:5px; max-width:280px; color:#475569; font-size:9px; font-weight:600; }
        .wheel-preview-wrap {
          position:relative; width:205px; height:205px; margin:13px 0 8px;
          display:flex; align-items:center; justify-content:center;
        }
        .preview-pointer {
          position:absolute; z-index:10; top:-4px; left:50%; transform:translateX(-50%);
          width:0; height:0; border-left:10px solid transparent; border-right:10px solid transparent;
          border-top:18px solid #050505; filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));
        }
        .preview-wheel {
          width:190px; height:190px; border-radius:50%; overflow:hidden;
          border:5px solid rgba(255,255,255,.65); box-shadow:0 8px 22px rgba(0,0,0,.2);
          transition-property:transform; transition-timing-function:cubic-bezier(.12,.65,.18,1);
        }
        .preview-wheel svg { display:block; width:100%; height:100%; }
        .preview-center {
          position:absolute; z-index:11; width:52px; height:52px; border-radius:50%;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          border:2px solid rgba(255,255,255,.9); box-shadow:0 3px 9px rgba(0,0,0,.2);
        }
        .preview-center strong { font-size:10px; line-height:1; font-weight:950; }
        .preview-center small { margin-top:2px; font-size:7px; line-height:1; font-weight:900; }
        .preview-spin-button {
          width:100%; max-width:265px; border:0; border-radius:8px; padding:10px 20px;
          font-size:10px; font-weight:950; letter-spacing:.07em; box-shadow:0 6px 14px rgba(0,0,0,.14);
          cursor:pointer;
        }
        .preview-spin-button:disabled { opacity:.65; cursor:not-allowed; }
        .preview-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; margin-top:12px; }
        .preview-stats > div {
          min-width:0; padding:9px 4px; text-align:center; background:#fff;
          border:1px solid #e2e8f0; border-radius:9px;
        }
        .preview-stats b { display:block; color:#0f172a; font-size:12px; font-weight:950; }
        .preview-stats span { display:block; margin-top:3px; color:#64748b; font-size:7px; font-weight:800; text-transform:uppercase; }
        .green-text { color:#059669 !important; }
        .preview-note { margin:9px 0 0; text-align:center; color:#94a3b8; font-size:9px; }
        .preview-note strong { color:#475569; }
        .loading-page {
          min-height:100vh; display:flex; align-items:center; justify-content:center; background:#f8fafc;
        }
        .loading-card {
          padding:22px 28px; border:1px solid #e2e8f0; border-radius:12px; background:#fff;
          color:#334155; font-size:12px; font-weight:800; box-shadow:0 10px 25px rgba(15,23,42,.06);
        }
        @media (max-width:1200px) {
          .workspace { grid-template-columns:minmax(0, 1fr) 390px; gap:28px; }
          .page-content { padding-left:24px; padding-right:24px; }
        }
        @media (max-width:900px) {
          .workspace { display:block; }
          .preview-column { position:static; margin-top:28px; }
          .page-heading { align-items:flex-start; }
          .configuration-status { display:none; }
        }
        @media (max-width:650px) {
          .admin-header { height:64px; }
          .header-inner { padding:0 14px; }
          .brand-title { font-size:10px; }
          .header-button { padding:8px 9px; font-size:9px; }
          .header-button span { display:none; }
          .page-content { padding:22px 14px 40px; }
          .page-heading h1 { font-size:24px; }
          .tabs { grid-template-columns:repeat(2,1fr); }
          .tab { min-height:60px; }
          .editor-body { padding:22px 15px; }
          .field-grid { grid-template-columns:1fr; }
          .field.full { grid-column:auto; }
          .form-footer { flex-direction:column; }
          .reset-button, .save-button { width:100%; }
          .preview-actions { flex-direction:column; align-items:flex-end; }
        }
      `}</style>
    </main>
  );
}

function PreviewWheelSvg({
  segments,
  textColor,
}: {
  segments: Array<Prize & { color: string }>;
  textColor: string;
}) {
  if (!segments.length) {
    return (
      <svg viewBox="0 0 100 100" aria-label="No active prizes">
        <circle cx="50" cy="50" r="49" fill="#e2e8f0" />
        <text x="50" y="53" textAnchor="middle" fontSize="5" fontWeight="700" fill="#64748b">
          NO PRIZES
        </text>
      </svg>
    );
  }

  const angle = 360 / segments.length;

  return (
    <svg viewBox="0 0 100 100" aria-label="Interactive wheel preview">
      {segments.map((segment, index) => {
        const rotate = index * angle;
        const textRotate = angle / 2;
        const label =
          segment.name.length > 14 ? segment.name.slice(0, 12) + ".." : segment.name;

        return (
          <g key={segment.id} transform={`rotate(${rotate} 50 50)`}>
            <path
              d={`M50 50 L50 0 A50 50 0 0 1 ${50 + 50 * Math.sin((angle * Math.PI) / 180)} ${50 - 50 * Math.cos((angle * Math.PI) / 180)} Z`}
              fill={segment.color}
            />
            <text
              x="68"
              y="28"
              fill={textColor}
              fontSize="5.3"
              fontWeight="800"
              textAnchor="middle"
              transform={`rotate(${textRotate} 50 50)`}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BrandingTab({
  settings,
  updateSetting,
}: {
  settings: WheelSettings;
  updateSetting: <K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) => void;
}) {
  return (
    <>
      <div className="section-head">
        <div className="heading-kicker">BRANDING & CONTENT</div>
        <h2>Branding & Typography</h2>
        <p>Control the brand identity, logo URL, font family, and customer-facing text.</p>
      </div>

      <div className="settings-section">
        <h3>Brand Identity</h3>
        <div className="settings-box">
          <div className="field-grid">
            <div className="field full">
              <label>Logo URL (Image URL or Brand Text)</label>
              <input
                value={settings.logo_url || ""}
                onChange={(e) => updateSetting("logo_url", e.target.value)}
                placeholder="Enter image URL or brand name..."
              />
              <p className="helper">Provide an image link for your logo or type brand text.</p>
            </div>

            <div className="field">
              <label>Header Brand Text</label>
              <input
                value={settings.header_text}
                onChange={(e) => updateSetting("header_text", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Online Brand Text</label>
              <input
                value={settings.online_text}
                onChange={(e) => updateSetting("online_text", e.target.value)}
              />
            </div>

            <div className="field full">
              <label>Font Family</label>
              <select
                value={settings.font_family}
                onChange={(e) => updateSetting("font_family", e.target.value)}
              >
                <option value="Inter, sans-serif">Inter</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="Poppins, sans-serif">Poppins</option>
                <option value="Montserrat, sans-serif">Montserrat</option>
                <option value="Playfair Display, serif">Playfair Display (Serif)</option>
                <option value="Arial, sans-serif">Arial</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Wheel Content</h3>
        <div className="settings-box">
          <div className="field-grid">
            <div className="field">
              <label>Wheel Title</label>
              <input
                value={settings.title}
                onChange={(e) => updateSetting("title", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Button Text</label>
              <input
                value={settings.button_text}
                onChange={(e) => updateSetting("button_text", e.target.value)}
              />
            </div>
            <div className="field full">
              <label>Subtitle</label>
              <input
                value={settings.subtitle}
                onChange={(e) => updateSetting("subtitle", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ColorsTab({
  settings,
  updateSetting,
}: {
  settings: WheelSettings;
  updateSetting: <K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) => void;
}) {
  const color = (label: string, key: keyof WheelSettings) => (
    <div className="field">
      <label>{label}</label>
      <div className="color-field">
        <input
          type="color"
          value={String(settings[key])}
          onChange={(e) => updateSetting(key, e.target.value as never)}
        />
        <input
          type="text"
          value={String(settings[key])}
          onChange={(e) => updateSetting(key, e.target.value as never)}
        />
      </div>
    </div>
  );

  return (
    <>
      <div className="section-head">
        <div className="heading-kicker">GENERAL COLORS</div>
        <h2>General Colors</h2>
        <p>Configure the main colors used across the Spin & Win experience.</p>
      </div>

      <div className="settings-section">
        <h3>Page & Button</h3>
        <div className="settings-box">
          <div className="field-grid">
            {color("Page Background Color", "page_background_color")}
            {color("Button Color", "button_color")}
            {color("Button Text Color", "button_text_color")}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Wheel Elements</h3>
        <div className="settings-box">
          <div className="field-grid">
            {color("Pointer Color", "pointer_color")}
            {color("Center Color", "center_color")}
            {color("Wheel Text Color", "text_color")}
          </div>
        </div>
      </div>
    </>
  );
}

function SegmentsTab({
  prizes,
  getPrizeColor,
  updatePrizeColor,
  onManagePrizes,
}: {
  prizes: Prize[];
  getPrizeColor: (prize: Prize, index: number) => string;
  updatePrizeColor: (id: string, color: string) => void;
  onManagePrizes: () => void;
}) {
  const activePrizes = prizes.filter((prize) => prize.active);

  return (
    <>
      <div className="section-head">
        <div className="heading-kicker">WHEEL SEGMENTS</div>
        <h2>Wheel Segments</h2>
        <p>Configure prize labels and slice colors for each active segment.</p>
      </div>

      <div className="settings-section">
        <div className="segment-section-title">
          <h3>Prize Colors</h3>
          <button type="button" className="manage-prizes" onClick={onManagePrizes}>
            Manage Prizes
          </button>
        </div>

        <div className="settings-box">
          {activePrizes.length === 0 ? (
            <div className="empty-state">
              No active prizes are available. Activate a prize in Prize Management first.
            </div>
          ) : (
            <div className="segment-list">
              {activePrizes.map((prize, index) => {
                const value = getPrizeColor(prize, index);

                return (
                  <div className="segment-row" key={prize.id}>
                    <div className="segment-number">{index + 1}</div>
                    <div className="segment-info">
                      <strong>{prize.name}</strong>
                      <small>Active prize segment</small>
                    </div>
                    <div className="segment-color">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => updatePrizeColor(prize.id, e.target.value)}
                      />
                      <code>{value.toUpperCase()}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AnimationTab({
  settings,
  updateSetting,
}: {
  settings: WheelSettings;
  updateSetting: <K extends keyof WheelSettings>(key: K, value: WheelSettings[K]) => void;
}) {
  return (
    <>
      <div className="section-head">
        <div className="heading-kicker">ANIMATION</div>
        <h2>Animation & Physics</h2>
        <p>Control how long the wheel spins before landing on a prize.</p>
      </div>

      <div className="settings-section">
        <h3>Spin Duration</h3>
        <div className="settings-box animation-box">
          <div className="animation-header">
            <span>SPIN DURATION</span>
            <strong>{Number(settings.animation_duration).toFixed(1)}s</strong>
          </div>
          <div className="range-wrap">
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={settings.animation_duration}
              onChange={(e) => updateSetting("animation_duration", Number(e.target.value))}
            />
          </div>
          <div className="range-labels">
            <span>1.0s (Fast)</span>
            <span>6.0s (Standard)</span>
            <span>10.0s (Cinematic)</span>
          </div>
          <div className="sound-row">
            <div>
              <strong>Mechanical Tick Sound</strong>
              <p>Preview-only option. Customer wheel sound remains unchanged.</p>
            </div>
            <span className="toggle-placeholder">ON</span>
          </div>
        </div>
      </div>
    </>
  );
}
