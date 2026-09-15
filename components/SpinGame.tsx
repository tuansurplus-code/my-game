"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Prize = {
  id: string;
  name: string;
  description?: string | null;
  segment_index: number;
  sort_order: number;
};

type Winner = {
  prize_id: string;
  prize_name: string;
  prize_description?: string | null;
  coupon_code: string;
  segment_index: number;
};

export default function SpinGame() {
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [win, setWin] = useState<Winner | null>(null);
  const [rotation, setRotation] = useState(0);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(true);

  // Load active prizes from Supabase
  useEffect(() => {
    async function loadPrizes() {
      setLoadingPrizes(true);

      const { data, error } = await supabase
        .from("prizes")
        .select("id,name,description,sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Prize loading error:", error);
        setMsg("Unable to load prizes.");
        setLoadingPrizes(false);
        return;
      }

      const formatted = (data || []).map((prize: any, index: number) => ({
        id: prize.id,
        name: prize.name,
        description: prize.description,
        sort_order: prize.sort_order,
        segment_index: index,
      }));

      setPrizes(formatted);
      setLoadingPrizes(false);
    }

    loadPrizes();
  }, []);

  const segmentAngle = prizes.length > 0 ? 360 / prizes.length : 72;

  // Generate the wheel background dynamically
  const wheelBackground = useMemo(() => {
    if (!prizes.length) return "";

    const stops = prizes.map((_, index) => {
      const start = index * segmentAngle;
      const end = (index + 1) * segmentAngle;

      return `hsl(${index * (360 / prizes.length)}, 75%, 55%) ${start}deg ${end}deg`;
    });

    return `conic-gradient(${stops.join(", ")})`;
  }, [prizes, segmentAngle]);

  function normalizeMobile(value: string) {
    let x = value.replace(/\D/g, "");

    if (x.startsWith("94")) {
      x = "0" + x.slice(2);
    }

    return x;
  }

  async function spin() {
    setMsg("");

    const normalizedMobile = normalizeMobile(mobile);

    if (!/^07\d{8}$/.test(normalizedMobile)) {
      setMsg("Enter a valid Sri Lankan mobile number.");
      return;
    }

    if (!prizes.length) {
      setMsg("No prizes are currently available.");
      return;
    }

    setBusy(true);

    const { data, error } = await supabase.rpc(
      process.env.NEXT_PUBLIC_SPIN_RPC || "spin_and_win",
      {
        p_mobile: normalizedMobile,
      }
    );

    if (error) {
      console.error("Spin error:", error);

      setBusy(false);

      const errorText = error.message?.toUpperCase() || "";

      if (
        errorText.includes("ALREADY") ||
        errorText.includes("DUPLICATE") ||
        errorText.includes("UNIQUE")
      ) {
        setMsg("This mobile has already used its spin.");
      } else {
        setMsg("Unable to complete the spin. Please try again.");
      }

      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      setBusy(false);
      setMsg("No result was returned. Please try again.");
      return;
    }

    const winnerIndex = Number(result.segment_index || 0);

    /*
      Each segment has an equal visual size.

      The server decides the actual prize using its configured
      probability/weight. The browser only uses segment_index
      to visually stop the wheel at that prize.
    */
    const winnerCenter = winnerIndex * segmentAngle + segmentAngle / 2;

    const targetRotation =
      rotation +
      2160 +
      (360 - (winnerCenter % 360));

    setRotation(targetRotation);

    setTimeout(() => {
      setWin(result);
      setBusy(false);
    }, 5000);
  }

  return (
    <div className="card">

      <div
        className="wheelWrap"
        style={{
          position: "relative",
          width: "min(90vw, 420px)",
          aspectRatio: "1 / 1",
          margin: "0 auto 30px",
        }}
      >
        {/* Pointer */}
        <i
          style={{
            position: "absolute",
            zIndex: 5,
            top: "-12px",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "18px solid transparent",
            borderRight: "18px solid transparent",
            borderTop: "35px solid #d71920",
          }}
        />

        {/* Wheel */}
        <div
          className="wheel"
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: wheelBackground || "#ddd",
            border: "8px solid white",
            boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
            transform: `rotate(${rotation}deg)`,
            transition: busy
              ? "transform 5s cubic-bezier(0.12, 0.65, 0.12, 1)"
              : "none",
            overflow: "hidden",
          }}
        >
          {prizes.map((prize, index) => {
            const angle = index * segmentAngle + segmentAngle / 2;

            return (
              <div
                key={prize.id}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: "42%",
                  transform: `
                    translate(-50%, -50%)
                    rotate(${angle}deg)
                    translateY(-88px)
                  `,
                  transformOrigin: "center center",
                  textAlign: "center",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "clamp(11px, 2.5vw, 15px)",
                  lineHeight: 1.1,
                  textShadow: "0 1px 3px rgba(0,0,0,.5)",
                }}
              >
                {prize.name}
              </div>
            );
          })}
        </div>

        {/* Center */}
        <div
          style={{
            position: "absolute",
            zIndex: 4,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 75,
            height: 75,
            borderRadius: "50%",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 13,
            color: "#d71920",
            boxShadow: "0 3px 12px rgba(0,0,0,.2)",
          }}
        >
          SINGHAGIRI
        </div>
      </div>

      {loadingPrizes && (
        <p style={{ textAlign: "center" }}>
          Loading prizes...
        </p>
      )}

      <div className="form">
        <input
          inputMode="tel"
          placeholder="07XXXXXXXX"
          maxLength={12}
          value={mobile}
          disabled={busy}
          onChange={(e) => setMobile(e.target.value)}
        />

        <button
          disabled={busy || loadingPrizes || prizes.length === 0}
          onClick={spin}
        >
          {busy ? "SPINNING..." : "SPIN NOW"}
        </button>
      </div>

      <small>
        One spin per mobile number.
      </small>

      {msg && (
        <p className="error">
          {msg}
        </p>
      )}

      {win && (
        <div className="modal">
          <div>
            <small>CONGRATULATIONS!</small>

            <h2>{win.prize_name}</h2>

            <p>
              {win.prize_description ||
                "You've won a Singhagiri reward."}
            </p>

            <b className="coupon">
              {win.coupon_code}
            </b>

            <button onClick={() => setWin(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
