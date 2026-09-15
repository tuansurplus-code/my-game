"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function AdminDashboard() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.replace("/admin/login");
      return;
    }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!admin) {
      await supabase.auth.signOut();
      router.replace("/admin/login");
      return;
    }

    setEmail(session.user.email || "");
    setChecking(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  if (checking) {
    return (
      <main className="loading">
        <div>
          <div className="loader-mark">S</div>
          <p>Checking administrator access...</p>
        </div>

        <style jsx>{`
          .loading {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: #f5f5f5;
          }

          .loader-mark {
            width: 50px;
            height: 50px;
            margin: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            background: #e31b23;
            color: white;
            font-size: 28px;
            font-weight: 900;
          }

          p {
            color: #777;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="admin-page">

      <header className="admin-header">

        <div className="header-brand">

          <div className="header-mark">
            S
          </div>

          <div>
            <div className="header-name">
              SINGHAGIRI
            </div>

            <div className="header-subtitle">
              SPIN & WIN ADMIN
            </div>
          </div>

        </div>

        <div className="header-right">

          <span className="admin-email">
            {email}
          </span>

          <button onClick={logout}>
            Logout
          </button>

        </div>

      </header>

      <section className="dashboard">

        <div className="welcome">

          <div>
            <div className="eyebrow">
              ADMINISTRATION
            </div>

            <h1>
              Spin & Win Dashboard
            </h1>

            <p>
              Manage your Singhagiri Spin & Win campaign.
            </p>
          </div>

        </div>

        <div className="coming-card">

          <div className="coming-icon">
            ⚙
          </div>

          <h2>
            Prize Management
          </h2>

          <p>
            The prize management panel is the next
            stage. You will be able to add, edit,
            activate, deactivate and delete prizes,
            as well as control winning weights,
            coupon prefixes and display order.
          </p>

          <div className="status">
            STAGE 2A — ADMIN LOGIN COMPLETE
          </div>

        </div>

        <button
          className="back-button"
          onClick={() => router.push("/")}
        >
          ← View Spin & Win
        </button>

      </section>

      <style jsx>{`

        .admin-page {
          min-height: 100vh;
          background: #f5f5f5;
        }

        .admin-header {
          min-height: 70px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 12px 28px;

          box-sizing: border-box;

          background: #fff;

          border-bottom: 1px solid #e7e7e7;
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-mark {
          width: 40px;
          height: 40px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 9px;

          background: #e31b23;
          color: white;

          font-size: 23px;
          font-weight: 900;
        }

        .header-name {
          font-size: 18px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .header-subtitle {
          margin-top: 1px;

          color: #e31b23;

          font-size: 8px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .admin-email {
          color: #777;
          font-size: 12px;
        }

        .header-right button {
          padding: 9px 15px;

          border: 1px solid #ddd;
          border-radius: 8px;

          background: white;
          color: #333;

          font-size: 12px;
          font-weight: 800;

          cursor: pointer;
        }

        .header-right button:hover {
          background: #f5f5f5;
        }

        .dashboard {
          width: 100%;
          max-width: 1000px;

          margin: auto;

          padding: 45px 25px;

          box-sizing: border-box;
        }

        .eyebrow {
          color: #e31b23;

          font-size: 10px;
          font-weight: 900;

          letter-spacing: 1.5px;
        }

        .welcome h1 {
          margin: 7px 0 5px;

          font-size: 34px;
          font-weight: 950;
        }

        .welcome p {
          margin: 0;

          color: #777;

          font-size: 15px;
        }

        .coming-card {
          margin-top: 35px;

          padding: 40px;

          border-radius: 20px;

          background: white;

          text-align: center;

          box-shadow:
            0 12px 40px rgba(0,0,0,.07);
        }

        .coming-icon {
          width: 58px;
          height: 58px;

          margin: auto;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 15px;

          background: #fff1f1;

          font-size: 27px;
        }

        .coming-card h2 {
          margin: 20px 0 8px;

          font-size: 24px;
        }

        .coming-card p {
          max-width: 620px;

          margin: auto;

          color: #777;

          font-size: 14px;
          line-height: 1.6;
        }

        .status {
          display: inline-block;

          margin-top: 22px;
          padding: 8px 13px;

          border-radius: 20px;

          background: #fff1f1;
          color: #e31b23;

          font-size: 10px;
          font-weight: 900;
          letter-spacing: .8px;
        }

        .back-button {
          display: block;

          margin: 25px auto;

          padding: 12px 20px;

          border: 1px solid #ddd;
          border-radius: 10px;

          background: white;
          color: #444;

          font-weight: 700;

          cursor: pointer;
        }

        @media (max-width: 650px) {

          .admin-header {
            padding: 12px 15px;
          }

          .admin-email {
            display: none;
          }

          .dashboard {
            padding: 30px 15px;
          }

          .welcome h1 {
            font-size: 28px;
          }

          .coming-card {
            padding: 30px 20px;
          }

        }

      `}</style>

    </main>
  );
}
