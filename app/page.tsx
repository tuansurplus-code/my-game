"use client";

import { useEffect, useState } from "react";
import SpinGame, { WheelSettings } from "../components/SpinGame";
import { supabase } from "../lib/supabase";

type AppWheelSettings = WheelSettings & {
  header_text: string;
  online_text: string;
  segment_1_color: string;
  segment_2_color: string;
  segment_3_color: string;
  segment_4_color: string;
  segment_5_color: string;
  segment_6_color: string;
};

const defaults: AppWheelSettings = {
  title: "SPIN & WIN",
  subtitle: "Spin daily and win exciting rewards!",
  button_text: "SPIN NOW",
  page_background_color: "#ffffff",
  button_color: "#e31b23",
  button_text_color: "#ffffff",
  pointer_color: "#e31b23",
  center_color: "#e31b23",
  text_color: "#ffffff",
  logo_url: null,
  font_family: "Arial, sans-serif",
  animation_duration: 5.2,
  header_text: "SINGHAGIRI",
  online_text: "SINGHAGIRI ONLINE",
  segment_1_color: "#e31b23",
  segment_2_color: "#f4b400",
  segment_3_color: "#1583d8",
  segment_4_color: "#18a05e",
  segment_5_color: "#7139a5",
  segment_6_color: "#e36c19",
};

export default function Home() {
  const [settings, setSettings] = useState<AppWheelSettings>(defaults);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const { data, error } = await supabase
      .from("wheel_settings")
      .select("title,subtitle,button_text,page_background_color,button_color,button_text_color,pointer_color,center_color,text_color,logo_url,font_family,animation_duration,header_text,online_text,segment_1_color,segment_2_color,segment_3_color,segment_4_color,segment_5_color,segment_6_color")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Wheel settings error:", error);
      return;
    }

    if (data) {
      setSettings({
        ...defaults,
        ...data,
        logo_url: data.logo_url || null,
        animation_duration: Number(data.animation_duration) || 5.2,
      });
    }
  }

  const segmentStyle = {
    ["--segment-0" as string]: settings.segment_1_color,
    ["--segment-1" as string]: settings.segment_2_color,
    ["--segment-2" as string]: settings.segment_3_color,
    ["--segment-3" as string]: settings.segment_4_color,
    ["--segment-4" as string]: settings.segment_5_color,
    ["--segment-5" as string]: settings.segment_6_color,
  } as React.CSSProperties;

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
