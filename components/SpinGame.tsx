"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Prize = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
};

type WinResult = {
  prize_id: string;
  prize_name: string;
  prize_description: string | null;
  coupon_code: string;
  segment_index: number;
};

export default function SpinGame() {
  const [mobile, setMobile] = useState("");
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [winner, setWinner] = useState<WinResult | null>(null);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    loadPrizes();
  }, []);

  async function loadPrizes() {
    setLoadingPrizes(true);

    const { data, error } = await supabase
      .from("prizes")
      .select("id,name,description,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Prize loading error:", error);
      setMessage("Unable to load prizes.");
      setLoadingPrizes(false);
      return;
    }

    setPrizes(data || []);
    setLoadingPrizes(false);
  }

  function normalizeMobile(value: string) {
    let number = value.replace(/\D/g, "");

    if (number.startsWith("94")) {
      number = "0" + number.slice(2);
    }

    return number;
  }

  function polarToCartesian(
    cx: number,
    cy: number,
    radius: number,
    angle: number
  ) {
    const radians = ((angle - 90) * Math.PI) / 180;

    return {
      x: cx + radius * Math.cos(radians),
      y: cy + radius * Math.sin(radians),
    };
  }

  function createSegment(
    index: number,
    total: number,
    radius: number
  ) {
    const startAngle = (360 / total) * index;
    const endAngle = (360 / total) * (index + 1);

    const start = polarToCartesian(200, 200, radius, endAngle);
    const end = polarToCartesian(200, 200, radius, startAngle);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `
      M 200 200
      L ${start.x} ${start.y}
      A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}
      Z
    `;
  }

  function getTextPosition(index: number, total: number) {
    const angle =
      (360 / total) * index +
      180 / total;

    return polarToCartesian(200, 200, 125, angle);
  }

  async function spin() {
    setMessage("");

    if (prizes.length === 0) {
      setMessage("No prizes are available.");
      return;
    }

    const normalized = normalizeMobile(mobile);

    if (!/^07\d{8}$/.test(normalized)) {
      setMessage("Enter a valid Sri Lankan mobile number.");
      return;
    }

    setBusy(true);

    const { data, error } = await supabase.rpc(
      process.env.NEXT_PUBLIC_SPIN_RPC || "spin_and_win",
      {
        p_mobile: normalized,
      }
    );

    if (error) {
      console.error("Spin error:", error);

      setBusy(false);

      if (
        error.message?.toUpperCase().includes("ALREADY") ||
        error.message?.toUpperCase().includes("DUPLICATE")
      ) {
        setMessage("This mobile number has already used its spin.");
      } else {
        setMessage("Unable to complete the spin. Please try again.");
      }

      return;
    }

    const result: WinResult = Array.isArray(data) ? data[0] : data;

    if (!result) {
      setBusy(false);
      setMessage("No result was returned. Please try again.");
      return;
    }

    const total = prizes.length;
    const segmentAngle = 360 / total;

    /*
      SVG segment 0 is centered at the top.
      We add several full rotations and then position
      the winning segment under the pointer.
    */

    const winnerIndex = Number(result.segment_index);

    const winnerCenter =
      winnerIndex * segmentAngle + segmentAngle / 2;

    const targetRotation =
      360 * 6 +
      (360 - winnerCenter);

    setRotation((current) => {
      const currentNormalized = current % 360;

      return (
        current +
        targetRotation -
        currentNormalized
      );
    });

    setTimeout(() => {
      setWinner(result);
      setBusy(false);
    }, 5200);
  }

  return (
    <div className="spin-card">

      <div className="wheel-container">

        {/* POINTER */}
        <div className="wheel-pointer">
          ▼
        </div>

        {/* WHEEL */}
        <div
          className="wheel"
          style={{
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {loadingPrizes ? (
            <div className="wheel-loading">
              Loading...
            </div>
          ) : prizes.length === 0 ? (
            <div className="wheel-loading">
              No prizes
            </div>
          ) : (
            <svg
              viewBox="0 0 400 400"
              className="wheel-svg"
            >
              {prizes.map((prize, index) => {
                const total = prizes.length;

                const position = getTextPosition(
                  index,
                  total
                );

                const angle =
                  (360 / total) * index +
                  180 / total;

                return (
                  <g key={prize.id}>

                    <path
                      d={createSegment(
                        index,
                        total,
                        190
                      )}
                      className={`wheel-segment segment-${index}`}
                    />

                    <g
                      transform={`
                        translate(${position.x} ${position.y})
                        rotate(${angle})
                      `}
                    >
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="wheel-text"
                      >
                        {prize.name.length > 18
                          ? prize.name.substring(0, 17) + "…"
                          : prize.name}
                      </text>
                    </g>

                  </g>
                );
              })}

              {/* CENTER */}
              <circle
                cx="200"
                cy="200"
                r="38"
                className="wheel-center"
              />

              <text
                x="200"
                y="195"
                textAnchor="middle"
                className="spin-center-text"
              >
                SPIN
              </text>

              <text
                x="200"
                y="215"
                textAnchor="middle"
                className="spin-center-sub"
              >
                & WIN
              </text>

            </svg>
          )}
        </div>

      </div>

      {/* CUSTOMER FORM */}
      <div className="spin-form">

        <input
          type="tel"
          inputMode="numeric"
          placeholder="Enter mobile number"
          maxLength={12}
          value={mobile}
          onChange={(e) =>
            setMobile(e.target.value)
          }
          disabled={busy}
        />

        <button
          onClick={spin}
          disabled={busy || loadingPrizes}
        >
          {busy ? "SPINNING..." : "SPIN NOW"}
        </button>

        <small>
          One spin per mobile number.
        </small>

      </div>

      {message && (
        <div className="spin-error">
          {message}
        </div>
      )}

      {/* WINNER MODAL */}
      {winner && (
        <div className="winner-overlay">

          <div className="winner-modal">

            <div className="winner-title">
              CONGRATULATIONS!
            </div>

            <h2>
              {winner.prize_name}
            </h2>

            <p>
              {winner.prize_description ||
                "You've won a Singhagiri reward!"}
            </p>

            <div className="coupon-label">
              YOUR COUPON CODE
            </div>

            <div className="coupon-code">
              {winner.coupon_code}
            </div>

            <button
              onClick={() => {
                setWinner(null);
                setMobile("");
              }}
            >
              DONE
            </button>

          </div>

        </div>
      )}

      <style jsx>{`

        .spin-card {
          width: 100%;
          max-width: 620px;
          margin: 30px auto;
          padding: 25px;
          border-radius: 24px;
          background: white;
          box-shadow: 0 15px 50px rgba(0,0,0,0.12);
        }

        .wheel-container {
          position: relative;
          width: min(90vw, 480px);
          aspect-ratio: 1;
          margin: 0 auto 30px;
        }

        .wheel {
          width: 100%;
          height: 100%;
          transition: transform 5s cubic-bezier(.12,.72,.12,1);
          will-change: transform;
        }

        .wheel-svg {
          width: 100%;
          height: 100%;
          display: block;
          filter: drop-shadow(
            0 10px 18px rgba(0,0,0,.2)
          );
        }

        .wheel-segment {
          stroke: white;
          stroke-width: 4;
        }

        .segment-0 {
          fill: #e31b23;
        }

        .segment-1 {
          fill: #f5b400;
        }

        .segment-2 {
          fill: #1683d8;
        }

        .segment-3 {
          fill: #16a05d;
        }

        .segment-4 {
          fill: #7b3fb6;
        }

        .wheel-text {
          fill: white;
          font-size: 15px;
          font-weight: 800;
          font-family: Arial, sans-serif;
          pointer-events: none;
        }

        .wheel-center {
          fill: white;
          stroke: #222;
          stroke-width: 5;
        }

        .spin-center-text {
          font-size: 15px;
          font-weight: 900;
          fill: #111;
        }

        .spin-center-sub {
          font-size: 11px;
          font-weight: 700;
          fill: #111;
        }

        .wheel-pointer {
          position: absolute;
          z-index: 10;
          top: -5px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 42px;
          line-height: 1;
          color: #111;
          text-shadow: 0 2px 3px rgba(0,0,0,.25);
        }

        .wheel-loading {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f3f3f3;
          color: #555;
          font-weight: 700;
        }

        .spin-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .spin-form input {
          width: 100%;
          box-sizing: border-box;
          padding: 15px 16px;
          border: 1px solid #ddd;
          border-radius: 10px;
          font-size: 16px;
          outline: none;
        }

        .spin-form input:focus {
          border-color: #e31b23;
        }

        .spin-form button {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 10px;
          background: #e31b23;
          color: white;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }

        .spin-form button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .spin-form small {
          text-align: center;
          color: #777;
        }

        .spin-error {
          margin-top: 15px;
          padding: 12px;
          border-radius: 8px;
          background: #fff1f1;
          color: #c00;
          text-align: center;
          font-size: 14px;
        }

        .winner-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0,0,0,.65);
        }

        .winner-modal {
          width: 100%;
          max-width: 420px;
          padding: 35px 25px;
          border-radius: 22px;
          background: white;
          text-align: center;
          box-shadow: 0 25px 80px rgba(0,0,0,.3);
        }

        .winner-title {
          color: #e31b23;
          font-weight: 900;
          font-size: 14px;
          letter-spacing: 1px;
        }

        .winner-modal h2 {
          margin: 12px 0;
          font-size: 30px;
        }

        .winner-modal p {
          color: #666;
        }

        .coupon-label {
          margin-top: 25px;
          font-size: 11px;
          color: #777;
          font-weight: 700;
        }

        .coupon-code {
          margin: 8px 0 25px;
          padding: 14px;
          border: 2px dashed #e31b23;
          border-radius: 10px;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .winner-modal button {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 10px;
          background: #111;
          color: white;
          font-weight: 800;
          cursor: pointer;
        }

        @media (max-width: 480px) {

          .spin-card {
            padding: 15px;
            box-shadow: none;
          }

          .wheel-container {
            width: min(92vw, 400px);
          }

          .wheel-text {
            font-size: 13px;
          }

        }

      `}</style>

    </div>
  );
}
