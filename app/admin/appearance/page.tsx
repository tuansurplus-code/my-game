"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Tab = "branding" | "colors" | "segments" | "animation";
type Prize = { id: string; name: string; active: boolean; sort_order: number };
type Settings = {
  id: number; title: string; subtitle: string; button_text: string;
  page_background_color: string; button_color: string; button_text_color: string;
  pointer_color: string; center_color: string; text_color: string;
  logo_url: string | null; font_family: string; animation_duration: number;
  header_text: string; online_text: string; segment_colors: Record<string,string>;
};

const defaults: Settings = {
  id: 1, title: "SPIN & WIN", subtitle: "Spin daily and win exciting rewards!", button_text: "SPIN NOW",
  page_background_color: "#9dbbe1", button_color: "#321be4", button_text_color: "#ffffff",
  pointer_color: "#050505", center_color: "#1e1be4", text_color: "#ffffff",
  logo_url: "https://www.singhagiri.lk/assets/images/logo.png", font_family: "Inter, sans-serif",
  animation_duration: 6, header_text: "PROMO GAME", online_text: "PROMO GAME ONLINE", segment_colors: {}
};
const palette = ["#AF181D","#D6B24C","#1B6AA7","#1F8E59","#7A34BC","#E36C19","#008B8B","#D63384"];

export default function WheelAppearancePage() {
  const router = useRouter();
  const [checking,setChecking]=useState(true);
  const [tab,setTab]=useState<Tab>("branding");
  const [settings,setSettings]=useState<Settings>(defaults);
  const [prizes,setPrizes]=useState<Prize[]>([]);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{ checkAdmin(); },[]);

  async function checkAdmin(){
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.user){ router.replace("/admin/login"); return; }
    const {data:admin}=await supabase.from("admin_users").select("user_id").eq("user_id",session.user.id).maybeSingle();
    if(!admin){ await supabase.auth.signOut(); router.replace("/admin/login"); return; }
    await Promise.all([loadSettings(),loadPrizes()]);
    setChecking(false);
  }
  async function loadSettings(){
    const {data,error}=await supabase.from("wheel_settings").select("*").eq("id",1).maybeSingle();
    if(error){setError(error.message);return;}
    if(data)setSettings({...defaults,...data,logo_url:data.logo_url||defaults.logo_url,segment_colors:data.segment_colors||{}});
  }
  async function loadPrizes(){
    const {data,error}=await supabase.from("prizes").select("id,name,active,sort_order").order("sort_order",{ascending:true});
    if(error){setError(error.message);return;} setPrizes((data||[]) as Prize[]);
  }
  const update=<K extends keyof Settings>(key:K,value:Settings[K])=>setSettings(s=>({...s,[key]:value}));
  const activePrizes=prizes.filter(p=>p.active);
  const color=(p:Prize,i:number)=>settings.segment_colors[p.id]||palette[i%palette.length];
  const previewSegments=activePrizes.map((p,i)=>color(p,i));
  const previewGradient=previewSegments.length
    ? `conic-gradient(${previewSegments.map((c,i)=>`${c} ${(i*100)/previewSegments.length}% ${((i+1)*100)/previewSegments.length}%`).join(", ")})`
    : "#eeeeee";

  async function save(e:FormEvent){
    e.preventDefault(); setSaving(true); setMessage(""); setError("");
    const payload={...settings,logo_url:settings.logo_url?.trim()||null,animation_duration:Number(settings.animation_duration),updated_at:new Date().toISOString()};
    const {error}=await supabase.from("wheel_settings").update(payload).eq("id",1);
    if(error)setError(error.message); else setMessage("Changes saved successfully.");
    setSaving(false);
  }
  function reset(){
    if(!window.confirm("Reset the wheel appearance form to the default design?"))return;
    const colors:Record<string,string>={}; prizes.forEach((p,i)=>colors[p.id]=palette[i%palette.length]);
    setSettings({...defaults,segment_colors:colors}); setTab("branding"); setMessage(""); setError("");
  }
  async function logout(){await supabase.auth.signOut();router.replace("/admin/login");}

  if(checking)return <main className="loading">Checking admin access...</main>;

  return <div className="page"><PageStyle/>
    <header className="topbar">
      <div className="topbar-brand"><div className="mark">S</div><div><div className="brand-red">PROMO GAME</div><div className="admin-title">SPIN & WIN ADMIN</div></div></div>
      <div className="top-actions"><button onClick={()=>router.push("/admin")}>▦ <span>Dashboard</span></button><button className="logout" onClick={logout}>↪ <span>Logout</span></button></div>
    </header>

    <main className="workspace">
      <section className="editor">
        <div className="intro"><span>CUSTOMIZATION</span><h1>Wheel Appearance</h1><p>Configure your Spin & Win experience branding, colors, and segments.</p></div>

        <div className="tabs">
          {([
            ["branding","✦","Branding","Logo, text & typography"],
            ["colors","◈","Colors","Page, button & wheel"],
            ["segments","◉","Segments","Prize segment colors"],
            ["animation","↻","Animation","Spin speed & motion"]
          ] as const).map(([id,icon,label,desc])=>
            <button key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>setTab(id as Tab)}>
              <div><b>{icon}</b><strong>{label}</strong></div><small>{desc}</small>
            </button>
          )}
        </div>

        <form onSubmit={save}>
          <div className="content">
            {tab==="branding" && <Branding settings={settings} update={update}/>}
            {tab==="colors" && <Colors settings={settings} update={update}/>}
            {tab==="segments" && <Segments prizes={activePrizes} color={color} update={(id,c)=>setSettings(s=>({...s,segment_colors:{...s.segment_colors,[id]:c}}))}/>}
            {tab==="animation" && <Animation settings={settings} update={update}/>}
          </div>
          {message&&<div className="message success">✓ {message}</div>}
          {error&&<div className="message error">! {error}</div>}
          <div className="footer"><button type="button" className="reset" onClick={reset}>Reset to Default</button><button className="save" disabled={saving}>⇩ <span>{saving?"Saving...":"Save Changes"}</span></button></div>
        </form>
      </section>

      <aside className="preview-card">
        <div className="preview-head"><div><span>PREVIEW</span><h2>Customer View</h2></div><div className="live"><i/> Live Preview</div></div>
        <div className="phone" style={{background:settings.page_background_color,fontFamily:settings.font_family}}>
          <div className="browser"><div><i/><i/><i/></div><code>singhagiri.lk/spin-win</code><b>•••</b></div>
          <div className="customer">
            <div className="fake-logo">{settings.header_text}</div>
            <h4>{settings.online_text}</h4><h3>{settings.title}</h3><p>{settings.subtitle}</p>
            <div className="mini-wheel-wrap">
              <div className="mini-pointer" style={{ color: settings.pointer_color }}>▼</div>
              <div className="mini-wheel">
                <div className="mini-segments" style={{ background: previewGradient }} />
                <div className="mini-center" style={{ background: settings.center_color }}>
                  <strong style={{ color: settings.text_color }}>SPIN</strong>
                  <small style={{ color: settings.text_color }}>& WIN</small>
                </div>
              </div>
            </div>
            <button style={{background:settings.button_color,color:settings.button_text_color}}>{settings.button_text}</button>
          </div>
        </div>
        <p className="static-note">This is a static UI design layout preview.</p>
      </aside>
    </main>
  </div>;
}

function Field({label,children,full=false}:{label:string;children:React.ReactNode;full?:boolean}){return <div className={full?"field full":"field"}><label>{label}</label>{children}</div>}
function Branding({settings:updateSettings,update}:{settings:Settings;update:<K extends keyof Settings>(k:K,v:Settings[K])=>void}){
  return <div className="tab-content">
    <div className="section-head"><h2>Branding & Content</h2><p>Control the brand identity, logo URL, font types, and customer-facing text.</p></div>
    <div className="fields">
      <Field label="Logo URL"><input value={updateSettings.logo_url||""} onChange={e=>update("logo_url",e.target.value)} placeholder="Enter image URL for logo"/></Field>
      <div className="grid2"><Field label="Header Brand Text"><input value={updateSettings.header_text} onChange={e=>update("header_text",e.target.value)}/></Field><Field label="Online Brand Text"><input value={updateSettings.online_text} onChange={e=>update("online_text",e.target.value)}/></Field></div>
      <div className="grid3"><Field label="Wheel Title"><input value={updateSettings.title} onChange={e=>update("title",e.target.value)}/></Field><Field label="Button Text"><input value={updateSettings.button_text} onChange={e=>update("button_text",e.target.value)}/></Field><Field label="Font Family"><select value={updateSettings.font_family} onChange={e=>update("font_family",e.target.value)}><option value="Inter, sans-serif">Inter</option><option value="Roboto, sans-serif">Roboto</option><option value="Poppins, sans-serif">Poppins</option><option value="Montserrat, sans-serif">Montserrat</option><option value="Arial, sans-serif">Arial</option></select></Field></div>
      <Field label="Subtitle"><input value={updateSettings.subtitle} onChange={e=>update("subtitle",e.target.value)}/></Field>
    </div>
  </div>
}
function Colors({settings,update}:{settings:Settings;update:<K extends keyof Settings>(k:K,v:Settings[K])=>void}){
 const item=(label:keyof Settings|string,key:keyof Settings)=><Field label={String(label)}><div className="color"><input type="color" value={String(settings[key])} onChange={e=>update(key,e.target.value as never)}/><input value={String(settings[key])} onChange={e=>update(key,e.target.value as never)}/></div></Field>;
 return <div className="tab-content"><div className="section-head"><h2>Colors</h2><p>Configure the colors used across the Spin & Win experience.</p></div><div className="fields"><div className="grid3">{item("Page Background Color","page_background_color")}{item("Button Color","button_color")}{item("Button Text Color","button_text_color")}</div><div className="grid3">{item("Pointer Color","pointer_color")}{item("Center Color","center_color")}{item("Wheel Text Color","text_color")}</div></div></div>
}
function Segments({prizes,color,update}:{prizes:Prize[];color:(p:Prize,i:number)=>string;update:(id:string,c:string)=>void}){
 return <div className="tab-content"><div className="section-head"><h2>Wheel Segments</h2><p>Configure prize labels and slice colors for each active segment.</p></div><div className="segment-list">{prizes.length?prizes.map((p,i)=><div className="segment" key={p.id}><b>{i+1}</b><span>{p.name}</span><input type="color" value={color(p,i)} onChange={e=>update(p.id,e.target.value)}/><code>{color(p,i)}</code></div>):<div className="empty">No active prizes are available.</div>}</div></div>
}
function Animation({settings,update}:{settings:Settings;update:<K extends keyof Settings>(k:K,v:Settings[K])=>void}){
 return <div className="tab-content"><div className="section-head"><h2>Animation</h2><p>Control spin speed and motion.</p></div><div className="animation"><div><label>SPIN DURATION</label><strong>{Number(settings.animation_duration).toFixed(1)}s</strong></div><input type="range" min="1" max="10" step="0.5" value={settings.animation_duration} onChange={e=>update("animation_duration",Number(e.target.value))}/><div className="range-labels"><span>1.0s (Fast)</span><span>6.0s (Standard)</span><span>10.0s (Cinematic)</span></div><div className="sound"><div><b>Mechanical Tick Sound</b><p>Preview-only option.</p></div><span>ON</span></div></div></div>
}

const css=`
*{box-sizing:border-box}.page{min-height:100vh;background:#f8fafc;color:#1e293b;font-family:Inter,Arial,sans-serif}.topbar{height:72px;background:#111827;color:white;padding:0 24px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 3px 12px rgba(15,23,42,.14)}.topbar-brand{display:flex;align-items:center;gap:12px}.mark{background:#dc2626;color:#fff;font-weight:950;font-size:19px;padding:6px 10px;border-radius:5px}.brand-red{font-size:12px;font-weight:900;letter-spacing:.14em;color:#ef4444}.admin-title{font-size:11px;color:#94a3b8;font-weight:600;margin-top:2px}.top-actions{display:flex;gap:10px}.top-actions button{display:flex;gap:8px;align-items:center;background:#1f2937;border:1px solid #374151;color:#e5e7eb;border-radius:8px;padding:9px 14px;font-size:11px;font-weight:600}.top-actions .logout{color:#f87171;border-color:#7f1d1d;background:#1f2937}.workspace{max-width:1600px;width:100%;margin:0 auto;padding:32px;display:grid;grid-template-columns:minmax(0,7fr) minmax(360px,5fr);gap:32px;align-items:start}.editor,.preview-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 1px 3px rgba(15,23,42,.04)}.editor{padding:32px}.intro{margin-bottom:24px}.intro span,.preview-head>div>span{font-size:11px;font-weight:800;color:#dc2626;text-transform:uppercase;letter-spacing:.12em}.intro h1{margin:2px 0 2px;font-size:25px;font-weight:900;color:#0f172a}.intro p{margin:0;color:#64748b;font-size:12px}.tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#f1f5f9;padding:6px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:32px}.tab{border:0;background:transparent;text-align:left;padding:12px;border-radius:9px;color:#475569}.tab.active{background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(15,23,42,.1);border:1px solid #e2e8f0}.tab div{display:flex;align-items:center;gap:7px}.tab b{color:#dc2626;font-size:16px}.tab strong{font-size:11px}.tab small{display:block;color:#64748b;font-size:9px;margin-top:3px}.content{min-height:300px}.section-head{border-bottom:1px solid #f1f5f9;padding-bottom:16px;margin-bottom:20px}.section-head h2{margin:0;font-size:16px;color:#0f172a;font-weight:800}.section-head p{margin:4px 0 0;color:#64748b;font-size:10px}.fields{display:flex;flex-direction:column;gap:16px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.field label{display:block;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#334155;margin-bottom:6px}.field input,.field select{width:100%;height:39px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;padding:0 13px;font-size:11px;color:#1e293b;outline:none}.field input:focus,.field select:focus{border-color:#dc2626;background:#fff}.color{display:grid;grid-template-columns:44px 1fr;gap:7px}.color input[type=color]{padding:3px}.segment-list{display:flex;flex-direction:column;gap:9px}.segment{display:grid;grid-template-columns:30px 1fr 42px 82px;gap:10px;align-items:center;padding:10px;border:1px solid #e2e8f0;border-radius:9px}.segment>b{width:25px;height:25px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:9px}.segment span{font-size:11px;font-weight:700}.segment input{width:40px;height:30px}.segment code{font-size:9px;color:#64748b}.empty{padding:24px;text-align:center;color:#94a3b8;font-size:11px;border:1px dashed #cbd5e1;border-radius:8px}.animation{background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:16px}.animation>div:first-child{display:flex;justify-content:space-between}.animation label{font-size:9px;font-weight:800;color:#475569}.animation strong{color:#dc2626;font-size:14px}.animation input{width:100%;accent-color:#dc2626;margin:16px 0 0}.range-labels{display:flex;justify-content:space-between;color:#94a3b8;font-size:8px}.sound{margin-top:18px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;display:flex;justify-content:space-between}.sound b{font-size:10px}.sound p{margin:3px 0 0;color:#94a3b8;font-size:8px}.sound span{background:#ecfdf5;color:#047857;border-radius:99px;padding:5px 9px;font-size:8px;font-weight:800}.footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f1f5f9;margin-top:28px;padding-top:20px}.reset,.save{border-radius:10px;padding:10px 20px;font-size:10px;font-weight:800}.reset{background:#fff;border:1px solid #cbd5e1;color:#475569}.save{background:#dc2626;color:#fff;border:0;box-shadow:0 5px 12px rgba(220,38,38,.18)}.message{margin-top:12px;padding:9px 12px;border-radius:7px;font-size:10px}.success{background:#ecfdf5;color:#047857}.error{background:#fef2f2;color:#b91c1c}.preview-card{padding:24px;display:flex;flex-direction:column;align-items:center}.preview-head{width:100%;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:12px;margin-bottom:16px}.preview-head h2{margin:3px 0 0;font-size:16px;color:#0f172a}.live{display:flex;gap:7px;align-items:center;background:#ecfdf5;border:1px solid #bbf7d0;color:#047857;border-radius:99px;padding:5px 11px;font-size:10px;font-weight:700}.live i{width:7px;height:7px;border-radius:50%;background:#10b981}.phone{width:100%;max-width:360px;border:4px solid #e2e8f0;border-radius:24px;padding:20px;box-shadow:0 8px 20px rgba(15,23,42,.12);overflow:hidden}.browser{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;opacity:.75}.browser>div{display:flex;gap:5px}.browser i{width:9px;height:9px;border-radius:50%;background:#ef4444}.browser i:nth-child(2){background:#eab308}.browser i:nth-child(3){background:#22c55e}.browser code{font-size:8px;color:#334155;font-weight:700}.browser b{font-size:9px;color:#334155}.customer{text-align:center;display:flex;flex-direction:column;align-items:center}.fake-logo{display:inline-block;background:#dc2626;color:#fff;font-weight:950;padding:3px 10px;border-radius:4px;font-size:9px;margin-bottom:4px}.customer h4{margin:0;color:#0f172a;font-size:10px;letter-spacing:.13em}.customer h3{margin:3px 0 0;color:#0f172a;font-size:20px;font-weight:950}.customer p{margin:3px 0 0;color:#1e293b;font-size:10px;font-weight:600}.mini-wheel-wrap{position:relative;width:190px;height:190px;margin:18px 0 12px;display:flex;align-items:center;justify-content:center}.mini-pointer{position:absolute;z-index:3;top:-7px;font-size:23px;line-height:1}.mini-wheel{position:relative;width:170px;height:170px;border-radius:50%;border:8px solid #fff;box-shadow:0 5px 18px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;overflow:hidden}.mini-segments{position:absolute;inset:0;border-radius:50%}.mini-center{position:relative;z-index:2;width:58px;height:58px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 3px 9px rgba(0,0,0,.2)}.mini-center strong{font-size:11px;line-height:1}.mini-center small{font-size:8px;font-weight:900;margin-top:2px}.customer>button{width:100%;margin-top:8px;padding:12px;border:0;border-radius:11px;font-size:11px;font-weight:950;letter-spacing:.08em;box-shadow:0 5px 10px rgba(0,0,0,.15)}.static-note{font-size:10px;color:#94a3b8;text-align:center;margin:14px 0 0}.loading{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#334155;font-weight:700}
@media(max-width:1100px){.workspace{grid-template-columns:1fr}.preview-card{order:2}.preview-column{position:static}}@media(max-width:700px){.workspace{padding:16px}.editor,.preview-card{padding:18px}.tabs{grid-template-columns:repeat(2,1fr)}.grid2,.grid3{grid-template-columns:1fr}.topbar{padding:0 14px}.top-actions span{display:none}}
`;

function PageStyle(){return <style jsx>{css}</style>}
