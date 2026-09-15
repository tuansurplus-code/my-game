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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadPrizes();
  }, []);

  async function loadPrizes() {
    setLoadingPrizes(true);
    setMessage("");

    const { data, error } = await supabase
      .from("prizes")
      .select("id,name,description,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error(error);
      setMessage("Unable to load prizes. Please refresh the page.");
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

  function createSegment(index: number, total: number, radius: number) {
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
    const angle = (360 / total) * index + 180 / total;

    return polarToCartesian(200, 200, 125, angle);
  }

  function formatMobile(value: string) {
    const clean = value.replace(/\D/g, "");

    if (clean.length <= 3) {
      return clean;
    }

    if (clean.length <= 6) {
      return `${clean.slice(0, 3)} ${clean.slice(3)}`;
    }

    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(
      6,
      10
    )}`;
  }

  async function spin() {
    setMessage("");
    setCopied(false);

    if (prizes.length === 0) {
      setMessage("No prizes are currently available.");
      return;
    }

    const normalized = normalizeMobile(mobile);

    if (!/^07\d{8}$/.test(normalized)) {
      setMessage("Please enter a valid Sri Lankan mobile number.");
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

      const errorText = error.message?.toUpperCase() || "";

      if (
        errorText.includes("ALREADY") ||
        errorText.includes("DUPLICATE") ||
        errorText.includes("UNIQUE")
      ) {
        setMessage(
          "This mobile number has already used its spin."
        );
      } else {
        setMessage(
          "Unable to complete the spin. Please try again."
        );
      }

      return;
    }

    const result: WinResult = Array.isArray(data)
      ? data[0]
      : data;

    if (!result) {
      setBusy(false);
      setMessage("No result was returned. Please try again.");
      return;
    }

    const total = prizes.length;
    const segmentAngle = 360 / total;
    const winnerIndex = Number(result.segment_index);

    const winnerCenter =
      winnerIndex * segmentAngle + segmentAngle / 2;

    /*
      Spin several full rotations first,
      then position the winning segment
      underneath the pointer.
    */

    const extraRotation = 360 * 7;
    const finalRotation = 360 - winnerCenter;

    setRotation((current) => {
      const currentNormalized = current % 360;

      return (
        current +
        extraRotation +
        finalRotation -
        currentNormalized
      );
    });

    setTimeout(() => {
      setWinner(result);
      setBusy(false);
    }, 5200);
  }

  async function copyCoupon() {
    if (!winner?.coupon_code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        winner.coupon_code
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setMessage("Unable to copy coupon code.");
    }
  }

  return (
    <div className="spin-section">

      {/* WHEEL HERO */}
      <div className="wheel-container">

        <div className="pointer">
          <div className="pointer-top"></div>
          <div className="pointer-arrow">▼</div>
        </div>

        <div
          className="wheel"
          style={{
            transform: `rotate(${rotation}deg)`,
          }}
        >

          {loadingPrizes ? (
            <div className="wheel-loading">
              Loading prizes...
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
                      className={`wheel-segment segment-${
                        index % 6
                      }`}
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
                          ? prize.name.substring(0, 17) + "..."
                          : prize.name}
                      </text>
                    </g>

                  </g>
                );
              })}

              {/* OUTER RING */}
              <circle
                cx="200"
                cy="200"
                r="190"
                className="wheel-border"
              />

              {/* CENTER BUTTON */}
              <circle
                cx="200"
                cy="200"
                r="43"
                className="wheel-center"
              />

              <circle
                cx="200"
                cy="200"
                r="34"
                className="wheel-center-inner"
              />

              <text
                x="200"
                y="197"
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
                &amp; WIN
              </text>

            </svg>
          )}

        </div>

        <div className="wheel-glow"></div>

      </div>

      {/* MOBILE ENTRY */}
      <div className="entry-card">

        <label>
          ENTER YOUR MOBILE NUMBER
        </label>

        <input
          type="tel"
          inputMode="numeric"
          placeholder="07X XXX XXXX"
          maxLength={12}
          value={formatMobile(mobile)}
          onChange={(e) => {
            const value = e.target.value.replace(
              /\D/g,
              ""
            );

            setMobile(value.slice(0, 10));
          }}
          disabled={busy}
        />

        <button
          className="spin-button"
          onClick={spin}
          disabled={busy || loadingPrizes}
        >
          <span>
            {busy ? "SPINNING..." : "SPIN NOW"}
          </span>

          {!busy && (
            <span className="button-arrow">
              →
            </span>
          )}
        </button>

        <div className="one-spin">
          🔒 One spin per mobile number
        </div>

      </div>

      {/* ERROR MESSAGE */}
      {message && (
        <div className="error-message">
          <span>!</span>
          {message}
        </div>
      )}

      {/* WINNER MODAL */}
      {winner && (
        <div className="winner-overlay">

          <div className="winner-modal">

            <div className="confetti">
              🎉
            </div>

            <div className="winner-small">
              CONGRATULATIONS!
            </div>

            <h2>
              YOU WON!
            </h2>

            <div className="winner-prize">
              {winner.prize_name}
            </div>

            <p className="winner-description">
              {winner.prize_description ||
                "You've won an exclusive Singhagiri reward!"}
            </p>

            <div className="coupon-title">
              YOUR EXCLUSIVE COUPON
            </div>

            <div className="coupon-box">
              <span>
                {winner.coupon_code}
              </span>
            </div>

            <button
              className="copy-button"
              onClick={copyCoupon}
            >
              {copied
                ? "✓ COPIED!"
                : "COPY COUPON CODE"}
            </button>

            <p className="coupon-note">
              Please save this coupon code and
              present it when redeeming your reward.
            </p>

            <button
              className="done-button"
              onClick={() => {
                setWinner(null);
                setMobile("");
                setCopied(false);
              }}
            >
              DONE
            </button>

          </div>

        </div>
      )}

      <style jsx>{`

        /* =========================
           MAIN GAME SECTION
        ========================= */

        .spin-section {
          width: 100%;
          max-width: 620px;
          margin: 20px auto 35px;
          padding: 10px 20px 30px;
          box-sizing: border-box;
        }


        /* =========================
           WHEEL
        ========================= */

        .wheel-container {
          position: relative;
          width: min(88vw, 500px);
          aspect-ratio: 1;
          margin: 0 auto 28px;
        }

        .wheel {
          position: relative;
          width: 100%;
          height: 100%;
          z-index: 2;

          transition:
            transform 5.2s cubic-bezier(.12,.72,.12,1);

          will-change: transform;
        }

        .wheel-svg {
          display: block;
          width: 100%;
          height: 100%;
          overflow: visible;

          filter:
            drop-shadow(
              0 12px 15px rgba(0,0,0,.20)
            );
        }

        .wheel-segment {
          stroke: white;
          stroke-width: 5;
        }

        .segment-0 {
          fill: #e31b23;
        }

        .segment-1 {
          fill: #f4b400;
        }

        .segment-2 {
          fill: #1583d8;
        }

        .segment-3 {
          fill: #18a05e;
        }

        .segment-4 {
          fill: #7139a5;
        }

        .segment-5 {
          fill: #e36c19;
        }

        .wheel-border {
          fill: none;
          stroke: #222;
          stroke-width: 8;
        }

        .wheel-text {
          fill: white;
          font-size: 15px;
          font-weight: 900;
          font-family: Arial, sans-serif;
          pointer-events: none;
        }

        .wheel-center {
          fill: white;
          stroke: #222;
          stroke-width: 5;
        }

        .wheel-center-inner {
          fill: #e31b23;
        }

        .spin-center-text {
          fill: white;
          font-size: 15px;
          font-weight: 900;
        }

        .spin-center-sub {
          fill: white;
          font-size: 10px;
          font-weight: 800;
        }


        /* =========================
           POINTER
        ========================= */

        .pointer {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          text-align: center;
        }

        .pointer-top {
          width: 18px;
          height: 18px;
          margin: auto;
          border-radius: 50%;
          background: #222;

          box-shadow:
            0 3px 7px rgba(0,0,0,.3);
        }

        .pointer-arrow {
          margin-top: -3px;
          color: #e31b23;
          font-size: 39px;
          line-height: 32px;

          text-shadow:
            0 3px 4px rgba(0,0,0,.25);
        }

        .wheel-glow {
          position: absolute;
          inset: 8%;
          border-radius: 50%;
          z-index: 1;
          pointer-events: none;

          box-shadow:
            0 0 35px rgba(227,27,35,.13);
        }

        .wheel-loading {
          width: 100%;
          height: 100%;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;
          background: #f1f1f1;
          color: #777;
          font-weight: 700;
        }


        /* =========================
           MOBILE ENTRY
        ========================= */

        .entry-card {
          width: 100%;
          max-width: 440px;
          margin: auto;
        }

        .entry-card label {
          display: block;
          margin-bottom: 8px;

          color: #333;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .7px;
          text-align: center;
        }

        .entry-card input {
          width: 100%;
          box-sizing: border-box;

          padding: 16px;

          border: 2px solid #e4e4e4;
          border-radius: 12px;

          background: white;

          font-size: 17px;
          text-align: center;
          letter-spacing: 1px;

          outline: none;

          transition: .2s;
        }

        .entry-card input:focus {
          border-color: #e31b23;

          box-shadow:
            0 0 0 3px rgba(227,27,35,.08);
        }


        /* =========================
           SPIN BUTTON
        ========================= */

        .spin-button {
          width: 100%;
          margin-top: 12px;
          padding: 17px;

          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;

          border: none;
          border-radius: 12px;

          background: #e31b23;
          color: white;

          font-size: 17px;
          font-weight: 900;
          letter-spacing: .5px;

          cursor: pointer;

          box-shadow:
            0 7px 18px rgba(227,27,35,.25);

          transition:
            transform .15s,
            box-shadow .15s;
        }

        .spin-button:hover:not(:disabled) {
          transform: translateY(-2px);

          box-shadow:
            0 10px 24px rgba(227,27,35,.32);
        }

        .spin-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .spin-button:disabled {
          opacity: .55;
          cursor: not-allowed;
          box-shadow: none;
        }

        .button-arrow {
          font-size: 22px;
        }

        .one-spin {
          margin-top: 12px;

          text-align: center;

          color: #888;
          font-size: 12px;
        }


        /* =========================
           ERROR
        ========================= */

        .error-message {
          max-width: 440px;
          margin: 15px auto 0;

          padding: 12px;

          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;

          border-radius: 9px;

          background: #fff1f1;
          color: #c5161d;

          font-size: 13px;
          text-align: center;
        }

        .error-message span {
          width: 18px;
          height: 18px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #e31b23;
          color: white;

          font-weight: 900;
          font-size: 11px;
        }


        /* =========================
           WINNER MODAL
        ========================= */

        .winner-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 20px;

          background: rgba(0,0,0,.72);

          backdrop-filter: blur(5px);
        }

        .winner-modal {
          width: 100%;
          max-width: 440px;
          max-height: 90vh;

          overflow-y: auto;
          box-sizing: border-box;

          padding: 32px 25px;

          border-radius: 24px;

          background: white;

          text-align: center;

          box-shadow:
            0 30px 100px rgba(0,0,0,.35);

          animation:
            winnerIn .35s ease-out;
        }

        @keyframes winnerIn {
          from {
            opacity: 0;
            transform:
              scale(.85)
              translateY(20px);
          }

          to {
            opacity: 1;
            transform:
              scale(1)
              translateY(0);
          }
        }

        .confetti {
          font-size: 42px;
          margin-bottom: 5px;
        }

        .winner-small {
          color: #e31b23;

          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .winner-modal h2 {
          margin: 5px 0 12px;

          font-size: 34px;
          font-weight: 950;
        }

        .winner-prize {
          padding: 14px 10px;

          border-radius: 12px;

          background: #fff2f2;
          color: #e31b23;

          font-size: 25px;
          font-weight: 950;
        }

        .winner-description {
          margin: 14px 0;

          color: #666;

          line-height: 1.5;
        }

        .coupon-title {
          margin-top: 20px;

          color: #777;

          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .coupon-box {
          margin-top: 7px;

          padding: 14px;

          border: 2px dashed #e31b23;
          border-radius: 11px;

          background: #fffafa;
        }

        .coupon-box span {
          font-size: 22px;
          font-weight: 950;
          letter-spacing: 2px;
        }

        .copy-button {
          width: 100%;
          margin-top: 10px;
          padding: 13px;

          border: none;
          border-radius: 10px;

          background: #222;
          color: white;

          font-weight: 800;

          cursor: pointer;
        }

        .coupon-note {
          margin: 12px 5px;

          color: #888;

          font-size: 11px;
          line-height: 1.5;
        }

        .done-button {
          width: 100%;
          margin-top: 8px;
          padding: 13px;

          border: 1px solid #ddd;
          border-radius: 10px;

          background: white;
          color: #333;

          font-weight: 800;

          cursor: pointer;
        }


        /* =========================
           MOBILE
        ========================= */

        @media (max-width: 520px) {

          .spin-section {
            margin: 10px auto 25px;
            padding: 5px 10px 25px;
          }

          .wheel-container {
            width: min(94vw, 430px);
            margin-bottom: 22px;
          }

          .wheel-text {
            font-size: 13px;
          }

          .winner-modal {
            padding: 28px 20px;
          }

          .winner-modal h2 {
            font-size: 29px;
          }

          .winner-prize {
            font-size: 22px;
          }

          .coupon-box span {
            font-size: 19px;
          }
        }

      `}</style>
    </div>
  );
}
