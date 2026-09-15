"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      const { data: admin } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (admin) {
        router.replace("/admin");
        return;
      }
    }

    setChecking(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) {
      console.error(loginError);

      setLoading(false);
      setError("Invalid email or password.");
      return;
    }

    if (!data.user) {
      setLoading(false);
      setError("Unable to sign in. Please try again.");
      return;
    }

    /*
      Authentication succeeded.
      Now verify that this user is registered
      in the admin_users table.
    */

    const { data: admin, error: adminError } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

    if (adminError) {
      console.error(adminError);

      await supabase.auth.signOut();

      setLoading(false);
      setError(
        "Unable to verify administrator access."
      );

      return;
    }

    if (!admin) {
      await supabase.auth.signOut();

      setLoading(false);
      setError(
        "You do not have administrator access."
      );

      return;
    }

    router.replace("/admin");
  }

  if (checking) {
    return (
      <main className="login-page">
        <div className="login-card loading-card">
          <div className="brand-mark">S</div>
          <h1>Checking access...</h1>
          <p>Please wait.</p>
        </div>

        <style jsx>{`
          .login-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
            background:
              radial-gradient(
                circle at top,
                #fff5f5 0%,
                #f5f5f5 55%,
                #eeeeee 100%
              );
          }

          .login-card {
            width: 100%;
            max-width: 420px;
            padding: 40px 30px;
            box-sizing: border-box;
            border-radius: 24px;
            background: white;
            text-align: center;
            box-shadow:
              0 20px 60px rgba(0, 0, 0, 0.12);
          }

          .brand-mark {
            width: 58px;
            height: 58px;
            margin: 0 auto 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 14px;
            background: #e31b23;
            color: white;
            font-size: 32px;
            font-weight: 900;
          }

          h1 {
            margin: 0;
            font-size: 22px;
          }

          p {
            color: #777;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="login-page">

      <div className="login-card">

        {/* BRAND */}
        <div className="brand">

          <div className="brand-mark">
            S
          </div>

          <div className="brand-name">
            SINGHAGIRI
          </div>

          <div className="brand-subtitle">
            SPIN & WIN
          </div>

        </div>

        {/* TITLE */}
        <div className="login-heading">
          <h1>Admin Login</h1>

          <p>
            Sign in to manage Spin & Win prizes.
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleLogin}>

          <div className="field">

            <label htmlFor="email">
              EMAIL ADDRESS
            </label>

            <input
              id="email"
              type="email"
              placeholder="admin@singhagiri.lk"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              disabled={loading}
            />

          </div>

          <div className="field">

            <label htmlFor="password">
              PASSWORD
            </label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              disabled={loading}
            />

          </div>

          {error && (
            <div className="error-message">
              <span>!</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading
              ? "SIGNING IN..."
              : "SIGN IN"}
          </button>

        </form>

        <button
          type="button"
          className="back-button"
          onClick={() => router.push("/")}
        >
          ← Back to Spin & Win
        </button>

        <div className="security-note">
          🔒 Authorized administrators only
        </div>

      </div>

      <style jsx>{`

        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;

          padding: 25px;
          box-sizing: border-box;

          background:
            radial-gradient(
              circle at top,
              #fff5f5 0%,
              #f6f6f6 55%,
              #eeeeee 100%
            );
        }

        .login-card {
          width: 100%;
          max-width: 430px;

          padding: 38px 32px 30px;

          box-sizing: border-box;

          border-radius: 24px;

          background: white;

          box-shadow:
            0 25px 70px rgba(0, 0, 0, 0.14),
            0 3px 12px rgba(0, 0, 0, 0.05);
        }

        /* BRAND */

        .brand {
          text-align: center;
          margin-bottom: 30px;
        }

        .brand-mark {
          width: 58px;
          height: 58px;

          margin: 0 auto 12px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 14px;

          background: #e31b23;
          color: white;

          font-size: 32px;
          font-weight: 900;
        }

        .brand-name {
          font-size: 22px;
          font-weight: 950;
          letter-spacing: 1.5px;
          color: #222;
        }

        .brand-subtitle {
          margin-top: 3px;

          color: #e31b23;

          font-size: 10px;
          font-weight: 900;
          letter-spacing: 3px;
        }

        /* HEADING */

        .login-heading {
          text-align: center;
          margin-bottom: 25px;
        }

        .login-heading h1 {
          margin: 0 0 7px;

          font-size: 28px;
          font-weight: 900;
          color: #222;
        }

        .login-heading p {
          margin: 0;

          color: #777;

          font-size: 14px;
          line-height: 1.5;
        }

        /* FORM */

        .field {
          margin-bottom: 17px;
        }

        .field label {
          display: block;

          margin-bottom: 7px;

          color: #333;

          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .field input {
          width: 100%;

          box-sizing: border-box;

          padding: 15px;

          border: 2px solid #e5e5e5;
          border-radius: 11px;

          background: #fff;

          color: #222;

          font-size: 15px;

          outline: none;

          transition:
            border-color 0.2s,
            box-shadow 0.2s;
        }

        .field input:focus {
          border-color: #e31b23;

          box-shadow:
            0 0 0 3px rgba(227, 27, 35, 0.08);
        }

        .field input:disabled {
          background: #f5f5f5;
        }

        /* ERROR */

        .error-message {
          display: flex;
          align-items: center;
          justify-content: center;

          gap: 8px;

          margin: 10px 0 15px;

          padding: 11px;

          border-radius: 9px;

          background: #fff1f1;

          color: #c5161d;

          font-size: 13px;

          text-align: center;
        }

        .error-message span {
          width: 18px;
          height: 18px;

          flex-shrink: 0;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #e31b23;

          color: white;

          font-size: 11px;
          font-weight: 900;
        }

        /* LOGIN BUTTON */

        .login-button {
          width: 100%;

          padding: 16px;

          border: none;
          border-radius: 11px;

          background: #e31b23;
          color: white;

          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0.5px;

          cursor: pointer;

          box-shadow:
            0 7px 18px rgba(227, 27, 35, 0.24);

          transition:
            transform 0.15s,
            box-shadow 0.15s;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);

          box-shadow:
            0 10px 24px rgba(227, 27, 35, 0.30);
        }

        .login-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* BACK */

        .back-button {
          width: 100%;

          margin-top: 12px;

          padding: 13px;

          border: 1px solid #ddd;
          border-radius: 10px;

          background: white;
          color: #444;

          font-size: 13px;
          font-weight: 700;

          cursor: pointer;
        }

        .back-button:hover {
          background: #f7f7f7;
        }

        /* SECURITY */

        .security-note {
          margin-top: 18px;

          text-align: center;

          color: #999;

          font-size: 11px;
        }

        @media (max-width: 520px) {

          .login-page {
            padding: 15px;
          }

          .login-card {
            padding: 32px 22px 25px;
            border-radius: 20px;
          }

          .login-heading h1 {
            font-size: 25px;
          }

        }

      `}</style>

    </main>
  );
}
