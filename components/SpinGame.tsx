"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Prize = { id: string; name: string; description: string | null; sort_order: number };
type WinResult = { prize_id: string; prize_name: string; prize_description: string | null; coupon_code: string; segment_index: number };
export type WheelSettings = {
  title: string; subtitle: string; button_text: string; page_background_color: string;
  button_color: string; button_text_color: string; pointer_color: string; center_color: string;
  text_color: string; logo_url: string | null; font_family: string; animation_duration: number;
  header_text?: string; online_text?: string; segment_colors?: Record<string, string>;
};
const defaults: WheelSettings = {
  title: "SPIN & WIN", subtitle: "Spin daily and win exciting rewards!", button_text: "SPIN NOW", page_background_color: "#ffffff",
  button_color: "#e31b23", button_text_color: "#ffffff", pointer_color: "#e31b23", center_color: "#e31b23", text_color: "#ffffff",
  logo_url: null, font_family: "Arial, sans-serif", animation_duration: 5.2,
};

export default function SpinGame({ settings = defaults }: { settings?: WheelSettings }) {
  const [mobile, setMobile] = useState(""); const [prizes, setPrizes] = useState<Prize[]>([]); const [loadingPrizes, setLoadingPrizes] = useState(true);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [winner, setWinner] = useState<WinResult | null>(null);
  const [rotation, setRotation] = useState(0); const [copied, setCopied] = useState(false);
  useEffect(() => { loadPrizes(); }, []);
  async function loadPrizes() {
    setLoadingPrizes(true); setMessage("");
    const { data, error } = await supabase.from("prizes").select("id,name,description,sort_order").eq("active", true).order("sort_order", { ascending: true });
    if (error) { console.error(error); setMessage("Unable to load prizes. Please refresh the page."); setLoadingPrizes(false); return; }
    setPrizes(data || []); setLoadingPrizes(false);
  }
  function normalizeMobile(value: string) { let number = value.replace(/\D/g, ""); if (number.startsWith("94")) number = "0" + number.slice(2); return number; }
  function polarToCartesian(cx: number, cy: number, radius: number, angle: number) { const radians = ((angle - 90) * Math.PI) / 180; return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }; }
  function createSegment(index: number, total: number, radius: number) { const startAngle = (360 / total) * index, endAngle = (360 / total) * (index + 1); const start = polarToCartesian(200, 200, radius, endAngle), end = polarToCartesian(200, 200, radius, startAngle); const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0; return `M 200 200 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`; }
  function getTextPosition(index: number, total: number) { return polarToCartesian(200, 200, 125, (360 / total) * index + 180 / total); }
  function formatMobile(value: string) { const clean = value.replace(/\D/g, ""); if (clean.length <= 3) return clean; if (clean.length <= 6) return `${clean.slice(0, 3)} ${clean.slice(3)}`; return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 10)}`; }
  async function spin() {
    setMessage(""); setCopied(false); if (!prizes.length) { setMessage("No prizes are currently available."); return; }
    const normalized = normalizeMobile(mobile); if (!/^07\d{8}$/.test(normalized)) { setMessage("Please enter a valid Sri Lankan mobile number."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc(process.env.NEXT_PUBLIC_SPIN_RPC || "spin_and_win", { p_mobile: normalized });
    if (error) { console.error("Spin error:", error); setBusy(false); const errorText = error.message?.toUpperCase() || ""; if (errorText.includes("ALREADY") || errorText.includes("DUPLICATE") || errorText.includes("UNIQUE")) setMessage("You have already used your spin today."); else setMessage("Unable to complete the spin. Please try again."); return; }
    const result: WinResult = Array.isArray(data) ? data[0] : data; if (!result) { setBusy(false); setMessage("No result was returned. Please try again."); return; }
    const total = prizes.length, segmentAngle = 360 / total, winnerIndex = Number(result.segment_index), winnerCenter = winnerIndex * segmentAngle + segmentAngle / 2, extraRotation = 360 * 7, finalRotation = 360 - winnerCenter;
    setRotation(current => { const currentNormalized = current % 360; return current + extraRotation + finalRotation - currentNormalized; });
    window.setTimeout(() => { setWinner(result); setBusy(false); }, settings.animation_duration * 1000);
  }
  async function copyCoupon() { if (!winner?.coupon_code) return; try { await navigator.clipboard.writeText(winner.coupon_code); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setMessage("Unable to copy coupon code."); } }
  const s = settings || defaults; const safeDuration = Number.isFinite(Number(s.animation_duration)) ? Number(s.animation_duration) : 5.2; const pageStyle = { fontFamily: s.font_family, backgroundColor: s.page_background_color };
  const fallbackColors = ["#e31b23", "#f4b400", "#1583d8", "#18a05e", "#7139a5", "#e36c19", "#008b8b", "#d63384", "#6f42c1", "#495057"];

  return <div className="spin-section" style={pageStyle}>
    {s.logo_url && <img className="game-logo" src={s.logo_url} alt="Singhagiri" />}
    <h1 className="game-title">{s.title}</h1><p className="game-subtitle">{s.subtitle}</p>
    <div className="wheel-container">
      <div className="pointer"><div className="pointer-top"></div><div className="pointer-arrow" style={{ color: s.pointer_color }}>▼</div></div>
      <div className="wheel" style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${safeDuration}s` }}>
        {loadingPrizes ? <div className="wheel-loading">Loading prizes...</div> : !prizes.length ? <div className="wheel-loading">No prizes</div> : <svg viewBox="0 0 400 400" className="wheel-svg">
          {prizes.map((prize, index) => { const total = prizes.length, position = getTextPosition(index, total), angle = (360 / total) * index + 180 / total, color = s.segment_colors?.[prize.id] || fallbackColors[index % fallbackColors.length]; return <g key={prize.id}>
            <path d={createSegment(index, total, 190)} className="wheel-segment" style={{ fill: color }} />
            <g transform={`translate(${position.x} ${position.y}) rotate(${angle})`}><text textAnchor="middle" dominantBaseline="middle" className="wheel-text" style={{ fill: s.text_color }}>{prize.name.length > 18 ? prize.name.substring(0, 17) + "..." : prize.name}</text></g>
          </g>; })}
          <circle cx="200" cy="200" r="190" className="wheel-border" /><circle cx="200" cy="200" r="43" className="wheel-center" /><circle cx="200" cy="200" r="34" className="wheel-center-inner" style={{ fill: s.center_color }} />
          <text x="200" y="197" textAnchor="middle" className="spin-center-text" style={{ fill: s.text_color }}>SPIN</text><text x="200" y="215" textAnchor="middle" className="spin-center-sub" style={{ fill: s.text_color }}>&amp; WIN</text>
        </svg>}
      </div><div className="wheel-glow"></div>
    </div>
    <div className="entry-card"><label>ENTER YOUR MOBILE NUMBER</label><input type="tel" inputMode="numeric" placeholder="07X XXX XXXX" maxLength={12} value={formatMobile(mobile)} onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} disabled={busy} />
      <button className="spin-button" onClick={spin} disabled={busy || loadingPrizes} style={{ background: s.button_color, color: s.button_text_color }}><span>{busy ? "SPINNING..." : s.button_text}</span>{!busy && <span className="button-arrow">→</span>}</button><div className="one-spin">🔒 One spin per mobile number</div>
    </div>
    {message && <div className="error-message"><span>!</span>{message}</div>}
    {winner && <div className="winner-overlay"><div className="winner-modal"><div className="confetti">🎉</div><div className="winner-small">CONGRATULATIONS!</div><h2>YOU WON!</h2><div className="winner-prize" style={{ color: s.button_color }}>{winner.prize_name}</div><p className="winner-description">{winner.prize_description || "You've won an exclusive Singhagiri reward!"}</p><div className="coupon-title">YOUR EXCLUSIVE COUPON</div><div className="coupon-box" style={{ borderColor: s.button_color }}><span>{winner.coupon_code}</span></div><button className="copy-button" onClick={copyCoupon}>{copied ? "✓ COPIED!" : "COPY COUPON CODE"}</button><p className="coupon-note">Please save this coupon code and present it when redeeming your reward.</p><button className="done-button" onClick={() => { setWinner(null); setMobile(""); setCopied(false); }}>DONE</button></div></div>}
    <style jsx>{`*{box-sizing:border-box}.spin-section{width:100%;max-width:680px;margin:0 auto;padding:22px 20px 35px;box-sizing:border-box;text-align:center;border-radius:18px}.game-logo{display:block;max-width:180px;max-height:60px;object-fit:contain;margin:0 auto 12px}.game-title{margin:0;font-size:30px;font-weight:950;letter-spacing:.05em}.game-subtitle{margin:6px 0 22px;color:#777;font-size:13px}.wheel-container{position:relative;width:min(88vw,500px);aspect-ratio:1;margin:0 auto 28px}.wheel{position:relative;width:100%;height:100%;z-index:2;transition-property:transform;transition-timing-function:cubic-bezier(.12,.72,.12,1);will-change:transform}.wheel-svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 12px 15px rgba(0,0,0,.20))}.wheel-segment{stroke:white;stroke-width:5}.wheel-border{fill:none;stroke:#222;stroke-width:8}.wheel-text{font-size:15px;font-weight:900;font-family:inherit;pointer-events:none}.wheel-center{fill:white;stroke:#222;stroke-width:5}.spin-center-text{font-size:15px;font-weight:900}.spin-center-sub{font-size:10px;font-weight:800}.pointer{position:absolute;top:-14px;left:50%;transform:translateX(-50%);z-index:20;text-align:center}.pointer-top{width:18px;height:18px;margin:auto;border-radius:50%;background:#222;box-shadow:0 3px 7px rgba(0,0,0,.3)}.pointer-arrow{margin-top:-3px;font-size:39px;line-height:32px;text-shadow:0 3px 4px rgba(0,0,0,.25)}.wheel-glow{position:absolute;inset:8%;border-radius:50%;z-index:1;pointer-events:none;box-shadow:0 0 35px rgba(227,27,35,.13)}.wheel-loading{width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#f1f1f1;color:#777;font-weight:700}.entry-card{width:100%;max-width:440px;margin:auto}.entry-card label{display:block;margin-bottom:8px;color:#333;font-size:11px;font-weight:800;letter-spacing:.7px}.entry-card input{width:100%;box-sizing:border-box;padding:16px;border:2px solid #e4e4e4;border-radius:12px;background:white;font-size:17px;text-align:center;letter-spacing:1px;outline:none;transition:.2s}.entry-card input:focus{border-color:#e31b23;box-shadow:0 0 0 3px rgba(227,27,35,.08)}.spin-button{width:100%;margin-top:12px;padding:17px;display:flex;align-items:center;justify-content:center;gap:15px;border:none;border-radius:12px;font-size:17px;font-weight:900;letter-spacing:.5px;cursor:pointer;box-shadow:0 7px 18px rgba(0,0,0,.15);transition:transform .15s,box-shadow .15s}.spin-button:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.2)}.spin-button:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}.button-arrow{font-size:22px}.one-spin{margin-top:12px;text-align:center;color:#888;font-size:12px}.error-message{max-width:440px;margin:15px auto 0;padding:12px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:9px;background:#fff1f1;color:#c5161d;font-size:13px}.error-message span{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:#e31b23;color:white;font-weight:900;font-size:11px}.winner-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}.winner-modal{width:100%;max-width:440px;max-height:90vh;overflow-y:auto;box-sizing:border-box;padding:32px 25px;border-radius:24px;background:white;text-align:center;box-shadow:0 30px 100px rgba(0,0,0,.35)}.confetti{font-size:42px;margin-bottom:5px}.winner-small{color:#e31b23;font-size:12px;font-weight:900;letter-spacing:1.5px}.winner-modal h2{margin:5px 0 12px;font-size:34px;font-weight:950}.winner-prize{padding:14px 10px;border-radius:12px;background:#fff2f2;font-size:25px;font-weight:950}.winner-description{margin:14px 0;color:#666;line-height:1.5}.coupon-title{margin-top:20px;color:#777;font-size:10px;font-weight:800;letter-spacing:1px}.coupon-box{margin-top:7px;padding:14px;border:2px dashed;border-radius:11px;background:#fffafa}.coupon-box span{font-size:22px;font-weight:950;letter-spacing:2px}.copy-button{width:100%;margin-top:10px;padding:13px;border:none;border-radius:10px;background:#222;color:white;font-weight:800;cursor:pointer}.coupon-note{margin:12px 5px;color:#888;font-size:11px;line-height:1.5}.done-button{width:100%;margin-top:8px;padding:13px;border:1px solid #ddd;border-radius:10px;background:white;color:#333;font-weight:800;cursor:pointer}@media(max-width:520px){.spin-section{padding:12px 10px}.game-title{font-size:26px}.wheel-container{width:min(94vw,430px)}.entry-card{max-width:100%}}`}</style>
  </div>;
}
