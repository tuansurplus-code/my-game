"use client";

import { useEffect, useState } from "react";
import SpinGame, { WheelSettings } from "../components/SpinGame";
import { supabase } from "../lib/supabase";

const defaults: WheelSettings = {
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
};

export default function Home() {
  const [settings, setSettings] = useState<WheelSettings>(defaults);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data, error } = await supabase
      .from("wheel_settings")
      .select("title,subtitle,button_text,page_background_color,button_color,button_text_color,pointer_color,center_color,text_color,logo_url,font_family,animation_duration")
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

  return (
    <main
      className="page"
      style={{
        minHeight: "100vh",
        background: settings.page_background_color,
        fontFamily: settings.font_family,
      }}
    >
      <header>
        <b>SINGHAGIRI</b>
        <span>SPIN &amp; WIN</span>
        <a href="/admin/login">Admin</a>
      </header>

      <section>
        <small>SINGHAGIRI ONLINE</small>
        <SpinGame settings={settings} />
      </section>

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
