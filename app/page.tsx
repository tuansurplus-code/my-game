"use client";

import { useEffect, useState } from "react";
import SpinGame, { WheelSettings } from "../components/SpinGame";
import { supabase } from "../lib/supabase";

type Prize = { id: string; sort_order: number };
type AppWheelSettings = WheelSettings & {
  header_text: string;
  online_text: string;
  segment_colors: Record<string, string>;
};

const palette = ["#e31b23", "#f4b400", "#1583d8", "#18a05e", "#7139a5", "#e36c19", "#008b8b", "#d63384", "#6f42c1", "#495057"];
const defaults: AppWheelSettings = {
  title: "SPIN & WIN", subtitle: "Spin daily and win exciting rewards!", button_text: "SPIN NOW", page_background_color: "#ffffff",
  button_color: "#e31b23", button_text_color: "#ffffff", pointer_color: "#e31b23", center_color: "#e31b23", text_color: "#ffffff",
  logo_url: null, font_family: "Arial, sans-serif", animation_duration: 5.2, header_text: "SINGHAGIRI", online_text: "SINGHAGIRI ONLINE", segment_colors: {},
};

export default function Home() {
  const [settings, setSettings] = useState<AppWheelSettings>(defaults);
  const [prizes, setPrizes] = useState<Prize[]>([]);

  useEffect(() => { loadSettings(); loadPrizes(); }, []);

  async function loadSettings() {
    const { data, error } = await supabase.from("wheel_settings").select("title,subtitle,button_text,page_background_color,button_color,button_text_color,pointer_color,center_color,text_color,logo_url,font_family,animation_duration,header_text,online_text,segment_colors").eq("id", 1).maybeSingle();
    if (error) { console.error("Wheel settings error:", error); return; }
    if (data) {
      const colors = data.segment_colors && typeof data.segment_colors === "object" && !Array.isArray(data.segment_colors) ? data.segment_colors : {};
      setSettings({ ...defaults, ...data, logo_url: data.logo_url || null, animation_duration: Number(data.animation_duration) || 5.2, segment_colors: colors });
    }
  }

  async function loadPrizes() {
    const { data, error } = await supabase.from("prizes").select("id,sort_order").eq("active", true).order("sort_order", { ascending: true });
    if (error) { console.error("Prize color mapping error:", error); return; }
    setPrizes((data || []) as Prize[]);
  }

  const segmentColors = prizes.map((prize, index) => settings.segment_colors[prize.id] || palette[index % palette.length]);
  const segmentStyle: React.CSSProperties = {};
  segmentColors.forEach((color, index) => { (segmentStyle as Record<string, string>)[`--segment-${index % 10}`] = color; });

  return (
    <main className="page" style={{ minHeight: "100vh", background: settings.page_background_color, fontFamily: settings.font_family, ...segmentStyle }}>
      <header>
        <b>{settings.header_text}</b>
        <span>{settings.title}</span>
        <a href="/admin/login">Admin</a>
      </header>
      <section>
        <small>{settings.online_text}</small>
        <SpinGame settings={settings} />
      </section>
      <style jsx global>{`
        .segment-0 { fill: var(--segment-0) !important; }
        .segment-1 { fill: var(--segment-1) !important; }
        .segment-2 { fill: var(--segment-2) !important; }
        .segment-3 { fill: var(--segment-3) !important; }
        .segment-4 { fill: var(--segment-4) !important; }
        .segment-5 { fill: var(--segment-5) !important; }
        .segment-6 { fill: var(--segment-6) !important; }
        .segment-7 { fill: var(--segment-7) !important; }
        .segment-8 { fill: var(--segment-8) !important; }
        .segment-9 { fill: var(--segment-9) !important; }
      `}</style>
      <style jsx>{`
        .page { width: 100%; color: #222; }
        header { min-height: 62px; padding: 14px 22px; display: flex; align-items: center; justify-content: space-between; gap: 15px; box-sizing: border-box; background: rgba(255,255,255,.92); border-bottom: 1px solid rgba(0,0,0,.08); }
        header b { font-size: 16px; letter-spacing: .08em; }
        header span { font-size: 11px; font-weight: 800; letter-spacing: .08em; color: #777; }
        header a { color: #222; text-decoration: none; font-size: 11px; font-weight: 800; }
        section { max-width: 760px; margin: 0 auto; padding: 24px 12px 45px; text-align: center; }
        section > small { display: block; margin-bottom: 4px; color: #999; font-size: 9px; font-weight: 900; letter-spacing: .18em; }
        @media (max-width: 520px) { header { padding: 12px 14px; } header span { display: none; } section { padding-top: 18px; } }
      `}</style>
    </main>
  );
}
