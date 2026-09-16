"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Prize = {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  active: boolean;
  sort_order: number;
  coupon_prefix: string | null;
};

type PrizeForm = {
  name: string;
  description: string;
  weight: string;
  coupon_prefix: string;
  sort_order: string;
  active: boolean;
};

/*
 * ============================================================
 * STAGE 3B - SPIN HISTORY TYPES
 * ============================================================
 */

type Spin = {
  id: string;
  mobile: string;
  prize_id: string;
  coupon_id: string;
  created_at: string;
};

type SpinHistory = {
  id: string;
  mobile: string;
  prize_id: string;
  coupon_id: string;
  created_at: string;
  prize_name: string;
  coupon_code: string;
  coupon_status: string;
};

const emptyForm: PrizeForm = {
  name: "",
  description: "",
  weight: "1",
  coupon_prefix: "",
  sort_order: "1",
  active: true,
};

export default function AdminDashboard() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(false);

  /*
   * ============================================================
   * STAGE 3B - HISTORY STATE
   * ============================================================
   */

  const [history, setHistory] = useState<SpinHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [form, setForm] = useState<PrizeForm>(emptyForm);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      router.replace("/admin/login");
      return;
    }

    setEmail(session.user.email || "");
    setChecking(false);

    await Promise.all([
      loadPrizes(),
      loadHistory(),
    ]);
  }

  async function loadPrizes() {
    setLoadingPrizes(true);
    setError("");

    const { data, error } = await supabase
      .from("prizes")
      .select(
        "id,name,description,weight,active,sort_order,coupon_prefix"
      )
      .order("sort_order", { ascending: true });

    if (error) {
      console.error(error);
      setError("Unable to load prizes.");
      setLoadingPrizes(false);
      return;
    }

    setPrizes((data || []) as Prize[]);
    setLoadingPrizes(false);
  }

  /*
   * ============================================================
   * STAGE 3B - LOAD SPIN & WIN HISTORY
   *
   * We intentionally query the tables separately.
   *
   * We do NOT use:
   *
   * prizes(name)
   * coupons(code,status)
   *
   * because the previous nested relationship query did not
   * work correctly with this Supabase database setup.
   * ============================================================
   */

  async function loadHistory(showRefresh = false) {
    if (showRefresh) {
      setRefreshingHistory(true);
    } else {
      setLoadingHistory(true);
    }

    setHistoryError("");

    try {
      /*
       * STEP 1
       * Load latest 100 spins.
       */

      const { data: spinsData, error: spinsError } =
        await supabase
          .from("spins")
          .select(
            "id,mobile,prize_id,coupon_id,created_at"
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(100);

      if (spinsError) {
        throw new Error(
          `Unable to load spins: ${spinsError.message}`
        );
      }

      const spins = (spinsData || []) as Spin[];

      /*
       * If there are no spins, show empty state.
       */

      if (spins.length === 0) {
        setHistory([]);
        return;
      }

      /*
       * STEP 2
       * Get unique prize IDs.
       */

      const prizeIds = [
        ...new Set(
          spins
            .map((spin) => spin.prize_id)
            .filter(Boolean)
        ),
      ];

      /*
       * STEP 3
       * Get unique coupon IDs.
       */

      const couponIds = [
        ...new Set(
          spins
            .map((spin) => spin.coupon_id)
            .filter(Boolean)
        ),
      ];

      /*
       * STEP 4
       * Load prize details separately.
       */

      const {
        data: prizesData,
        error: prizesError,
      } = await supabase
        .from("prizes")
        .select("id,name")
        .in("id", prizeIds);

      if (prizesError) {
        throw new Error(
          `Unable to load prize details: ${prizesError.message}`
        );
      }

      /*
       * STEP 5
       * Load coupon details separately.
       */

      const {
        data: couponsData,
        error: couponsError,
      } = await supabase
        .from("coupons")
        .select("id,code,status")
        .in("id", couponIds);

      if (couponsError) {
        throw new Error(
          `Unable to load coupon details: ${couponsError.message}`
        );
      }

      /*
       * STEP 6
       * Create prize lookup map.
       */

      const prizeMap = new Map<string, string>();

      (prizesData || []).forEach((prize) => {
        prizeMap.set(prize.id, prize.name);
      });

      /*
       * STEP 7
       * Create coupon lookup map.
       */

      const couponMap = new Map<
        string,
        {
          code: string;
          status: string;
        }
      >();

      (couponsData || []).forEach((coupon) => {
        couponMap.set(coupon.id, {
          code: coupon.code,
          status: coupon.status,
        });
      });

      /*
       * STEP 8
       * Combine spin + prize + coupon data.
       */

      const combinedHistory: SpinHistory[] =
        spins.map((spin) => {
          const coupon = couponMap.get(
            spin.coupon_id
          );

          return {
            id: spin.id,
            mobile: spin.mobile,
            prize_id: spin.prize_id,
            coupon_id: spin.coupon_id,
            created_at: spin.created_at,

            prize_name:
              prizeMap.get(spin.prize_id) ||
              "Prize unavailable",

            coupon_code:
              coupon?.code ||
              "Coupon unavailable",

            coupon_status:
              coupon?.status ||
              "unknown",
          };
        });

      setHistory(combinedHistory);
    } catch (err) {
      console.error(err);

      setHistoryError(
        err instanceof Error
          ? err.message
          : "Unable to load spin history."
      );

      setHistory([]);
    } finally {
      setLoadingHistory(false);
      setRefreshingHistory(false);
    }
  }

  function openAddForm() {
    setEditingPrize(null);

    setForm({
      ...emptyForm,
      sort_order: String(prizes.length + 1),
    });

    setMessage("");
    setError("");
    setShowForm(true);
  }

  function openEditForm(prize: Prize) {
    setEditingPrize(prize);

    setForm({
      name: prize.name,
      description: prize.description || "",
      weight: String(prize.weight),
      coupon_prefix: prize.coupon_prefix || "",
      sort_order: String(prize.sort_order),
      active: prize.active,
    });

    setMessage("");
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingPrize(null);
    setForm(emptyForm);
  }

  async function savePrize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    const name = form.name.trim();
    const description = form.description.trim();
    const couponPrefix = form.coupon_prefix
      .trim()
      .toUpperCase();

    const weight = Number(form.weight);
    const sortOrder = Number(form.sort_order);

    if (!name) {
      setError("Please enter a prize name.");
      return;
    }

    if (!Number.isFinite(weight) || weight < 0) {
      setError("Weight must be 0 or greater.");
      return;
    }

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 1
    ) {
      setError(
        "Display order must be a whole number starting from 1."
      );
      return;
    }

    if (!couponPrefix) {
      setError("Please enter a coupon prefix.");
      return;
    }

    if (couponPrefix.length > 10) {
      setError(
        "Coupon prefix must be 10 characters or less."
      );
      return;
    }

    setSaving(true);

    if (editingPrize) {
      const { error } = await supabase
        .from("prizes")
        .update({
          name,
          description: description || null,
          weight,
          active: form.active,
          sort_order: sortOrder,
          coupon_prefix: couponPrefix,
        })
        .eq("id", editingPrize.id);

      if (error) {
        console.error(error);
        setError(
          error.message ||
            "Unable to update prize."
        );
        setSaving(false);
        return;
      }

      setMessage("Prize updated successfully.");
    } else {
      const { error } = await supabase
        .from("prizes")
        .insert({
          name,
          description: description || null,
          weight,
          active: form.active,
          sort_order: sortOrder,
          coupon_prefix: couponPrefix,
        });

      if (error) {
        console.error(error);
        setError(
          error.message ||
            "Unable to add prize."
        );
        setSaving(false);
        return;
      }

      setMessage("Prize added successfully.");
    }

    setSaving(false);
    setShowForm(false);
    setEditingPrize(null);
    setForm(emptyForm);

    await loadPrizes();
  }

  async function togglePrize(prize: Prize) {
    setError("");
    setMessage("");

    const { error } = await supabase
      .from("prizes")
      .update({
        active: !prize.active,
      })
      .eq("id", prize.id);

    if (error) {
      console.error(error);
      setError(
        error.message ||
          "Unable to change prize status."
      );
      return;
    }

    setMessage(
      `${prize.name} is now ${
        !prize.active ? "active" : "inactive"
      }.`
    );

    await loadPrizes();
  }

  async function deletePrize(prize: Prize) {
    const confirmed = window.confirm(
      `Delete "${prize.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(prize.id);
    setError("");
    setMessage("");

    const { error } = await supabase
      .from("prizes")
      .delete()
      .eq("id", prize.id);

    if (error) {
      console.error(error);
      setError(
        error.message ||
          "Unable to delete prize."
      );
      setDeleting(null);
      return;
    }

    setMessage(
      `${prize.name} has been deleted.`
    );

    setDeleting(null);

    await loadPrizes();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  /*
   * ============================================================
   * STAGE 3A - ADMIN OVERVIEW CALCULATIONS
   * ============================================================
   */

  const totalPrizes = prizes.length;

  const activePrizes = prizes.filter(
    (prize) => prize.active
  ).length;

  const inactivePrizes = prizes.filter(
    (prize) => !prize.active
  ).length;

  const totalWinningWeight = prizes.reduce(
    (total, prize) =>
      total + Number(prize.weight || 0),
    0
  );

  /*
   * Only active prizes participate in the wheel.
   */

  const activeWinningWeight = prizes
    .filter((prize) => prize.active)
    .reduce(
      (total, prize) =>
        total + Number(prize.weight || 0),
      0
    );

  if (checking) {
    return (
      <main className="loading">
        <div>
          <div className="loader-mark">
            S
          </div>

          <p>
            Checking administrator access...
          </p>
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

          <button
            className="add-button"
            onClick={openAddForm}
          >
            + Add Prize
          </button>
        </div>

        {message && (
          <div className="success-message">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="error-message">
            ! {error}
          </div>
        )}

        {/* =====================================================
            STAGE 3A - ADMIN OVERVIEW
        ====================================================== */}

        <div className="overview-header">
          <div>
            <div className="eyebrow">
              CAMPAIGN OVERVIEW
            </div>

            <h2>
              Prize Overview
            </h2>

            <p>
              Quick summary of your current Spin & Win configuration.
            </p>
          </div>
        </div>

        <div className="overview-grid">
          <div className="overview-card">
            <div className="overview-icon">
              🎁
            </div>

            <div className="overview-content">
              <div className="overview-label">
                TOTAL PRIZES
              </div>

              <div className="overview-value">
                {totalPrizes}
              </div>

              <div className="overview-description">
                All configured prizes
              </div>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon active-icon">
              ✓
            </div>

            <div className="overview-content">
              <div className="overview-label">
                ACTIVE PRIZES
              </div>

              <div className="overview-value">
                {activePrizes}
              </div>

              <div className="overview-description">
                Currently available on wheel
              </div>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon inactive-icon">
              ○
            </div>

            <div className="overview-content">
              <div className="overview-label">
                INACTIVE PRIZES
              </div>

              <div className="overview-value">
                {inactivePrizes}
              </div>

              <div className="overview-description">
                Currently disabled
              </div>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon weight-icon">
              %
            </div>

            <div className="overview-content">
              <div className="overview-label">
                ACTIVE WEIGHT
              </div>

              <div className="overview-value">
                {activeWinningWeight}
              </div>

              <div className="overview-description">
                Total active winning weight
              </div>
            </div>
          </div>
        </div>

        <div className="weight-info">
          <div className="weight-info-icon">
            ℹ
          </div>

          <div>
            <strong>
              Winning probability
            </strong>

            <p>
              Each active prize's probability is calculated from
              its weight relative to the total active weight.
            </p>
          </div>
        </div>

        {/* =====================================================
            PRIZE MANAGEMENT
        ====================================================== */}

        <div className="section-header">
          <div>
            <h2>
              Prize Management
            </h2>

            <p>
              Control prizes, winning weights and coupon settings.
            </p>
          </div>

          <div className="prize-count">
            {prizes.length} prize
            {prizes.length !== 1
              ? "s"
              : ""}
          </div>
        </div>

        {loadingPrizes ? (
          <div className="loading-box">
            Loading prizes...
          </div>
        ) : prizes.length === 0 ? (
          <div className="empty-box">
            <div className="empty-icon">
              🎁
            </div>

            <h3>
              No prizes found
            </h3>

            <p>
              Add your first Spin & Win prize to get started.
            </p>

            <button
              className="add-button"
              onClick={openAddForm}
            >
              + Add Prize
            </button>
          </div>
        ) : (
          <div className="table-card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>PRIZE</th>
                    <th>WEIGHT</th>
                    <th>COUPON</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {prizes.map((prize) => (
                    <tr key={prize.id}>
                      <td>
                        <span className="order-number">
                          {prize.sort_order}
                        </span>
                      </td>

                      <td>
                        <div className="prize-name">
                          {prize.name}
                        </div>

                        {prize.description && (
                          <div className="prize-description">
                            {prize.description}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className="weight">
                          {prize.weight}
                        </span>
                      </td>

                      <td>
                        <span className="coupon-prefix">
                          {prize.coupon_prefix || "-"}
                        </span>
                      </td>

                      <td>
                        <button
                          className={
                            prize.active
                              ? "status active"
                              : "status inactive"
                          }
                          onClick={() =>
                            togglePrize(prize)
                          }
                        >
                          {prize.active
                            ? "ACTIVE"
                            : "INACTIVE"}
                        </button>
                      </td>

                      <td>
                        <div className="actions">
                          <button
                            className="edit-button"
                            onClick={() =>
                              openEditForm(prize)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="delete-button"
                            disabled={
                              deleting ===
                              prize.id
                            }
                            onClick={() =>
                              deletePrize(prize)
                            }
                          >
                            {deleting ===
                            prize.id
                              ? "..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================
            STAGE 3B - SPIN & WIN HISTORY
        ====================================================== */}

        <div className="section-header history-section-header">
          <div>
            <div className="eyebrow">
              CAMPAIGN ACTIVITY
            </div>

            <h2>
              Spin & Winner History
            </h2>

            <p>
              View recent customer spins, prizes and generated coupon codes.
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={() =>
              loadHistory(true)
            }
            disabled={
              refreshingHistory ||
              loadingHistory
            }
          >
            {refreshingHistory
              ? "Refreshing..."
              : "↻ Refresh History"}
          </button>
        </div>

        {/* HISTORY SUMMARY */}

        <div className="history-summary">
          <div className="history-summary-card">
            <div className="history-summary-label">
              SPINS LOADED
            </div>

            <div className="history-summary-value">
              {history.length}
            </div>

            <div className="history-summary-description">
              Latest spin records
            </div>
          </div>

          <div className="history-summary-card">
            <div className="history-summary-label">
              ISSUED COUPONS
            </div>

            <div className="history-summary-value">
              {
                history.filter(
                  (item) =>
                    item.coupon_status ===
                    "issued"
                ).length
              }
            </div>

            <div className="history-summary-description">
              Coupons generated
            </div>
          </div>

          <div className="history-summary-card">
            <div className="history-summary-label">
              LATEST SPIN
            </div>

            <div className="history-summary-latest">
              {history.length > 0
                ? new Date(
                    history[0].created_at
                  ).toLocaleString(
                    "en-LK",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )
                : "No spins yet"}
            </div>

            <div className="history-summary-description">
              Most recent activity
            </div>
          </div>
        </div>

        {/* HISTORY ERROR */}

        {historyError && (
          <div className="history-error">
            <div>
              <strong>
                Unable to load spin history
              </strong>

              <p>
                {historyError}
              </p>
            </div>

            <button
              onClick={() =>
                loadHistory(true)
              }
            >
              Try Again
            </button>
          </div>
        )}

        {/* HISTORY TABLE */}

        {loadingHistory ? (
          <div className="loading-box">
            Loading spin history...
          </div>
        ) : history.length === 0 ? (
          <div className="empty-box">
            <div className="empty-icon">
              🎡
            </div>

            <h3>
              No spin records yet
            </h3>

            <p>
              Customer Spin & Win activity will appear here.
            </p>
          </div>
        ) : (
          <div className="table-card history-table-card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>DATE & TIME</th>
                    <th>MOBILE</th>
                    <th>PRIZE</th>
                    <th>COUPON CODE</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((spin) => {
                    const date =
                      new Date(
                        spin.created_at
                      );

                    const formattedDate =
                      date.toLocaleString(
                        "en-LK",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      );

                    const mobile =
                      spin.mobile.length > 7
                        ? `${spin.mobile.slice(
                            0,
                            5
                          )}****${spin.mobile.slice(
                            -2
                          )}`
                        : spin.mobile;

                    return (
                      <tr
                        key={spin.id}
                      >
                        <td>
                          <div className="history-date">
                            {formattedDate}
                          </div>
                        </td>

                        <td>
                          <span className="history-mobile">
                            {mobile}
                          </span>
                        </td>

                        <td>
                          <div className="history-prize">
                            {spin.prize_name}
                          </div>
                        </td>

                        <td>
                          <span className="history-coupon">
                            {spin.coupon_code}
                          </span>
                        </td>

                        <td>
                          {spin.coupon_status ===
                          "issued" ? (
                            <span className="history-status issued">
                              ISSUED
                            </span>
                          ) : spin.coupon_status ===
                            "redeemed" ? (
                            <span className="history-status redeemed">
                              REDEEMED
                            </span>
                          ) : (
                            <span className="history-status unknown">
                              {spin.coupon_status.toUpperCase()}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="history-limit-note">
          Showing the latest 100 spin records.
        </div>

        <button
          className="back-button"
          onClick={() =>
            router.push("/")
          }
        >
          ← View Spin & Win
        </button>
      </section>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-eyebrow">
                  {editingPrize
                    ? "EDIT PRIZE"
                    : "NEW PRIZE"}
                </div>

                <h2>
                  {editingPrize
                    ? "Edit Prize"
                    : "Add Prize"}
                </h2>
              </div>

              <button
                className="close-button"
                onClick={closeForm}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form onSubmit={savePrize}>
              <div className="form-field">
                <label>
                  PRIZE NAME
                </label>

                <input
                  type="text"
                  value={form.name}
                  placeholder="e.g. 10% OFF"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                  disabled={saving}
                />
              </div>

              <div className="form-field">
                <label>
                  DESCRIPTION
                </label>

                <textarea
                  value={
                    form.description
                  }
                  placeholder="Optional prize description"
                  rows={3}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description:
                        e.target.value,
                    })
                  }
                  disabled={saving}
                />
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>
                    WINNING WEIGHT
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.weight}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weight:
                          e.target.value,
                      })
                    }
                    disabled={saving}
                  />

                  <small>
                    Higher weight = higher chance.
                  </small>
                </div>

                <div className="form-field">
                  <label>
                    DISPLAY ORDER
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      form.sort_order
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sort_order:
                          e.target.value,
                      })
                    }
                    disabled={saving}
                  />

                  <small>
                    Controls wheel order.
                  </small>
                </div>
              </div>

              <div className="form-field">
                <label>
                  COUPON PREFIX
                </label>

                <input
                  type="text"
                  maxLength={10}
                  value={
                    form.coupon_prefix
                  }
                  placeholder="e.g. SG10"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      coupon_prefix:
                        e.target.value.toUpperCase(),
                    })
                  }
                  disabled={saving}
                />

                <small>
                  Example: SG10-XXXXXXXX
                </small>
              </div>

              <div className="active-toggle">
                <div>
                  <strong>
                    Prize Status
                  </strong>

                  <p>
                    {form.active
                      ? "This prize can be won."
                      : "This prize is hidden from the wheel."}
                  </p>
                </div>

                <button
                  type="button"
                  className={
                    form.active
                      ? "toggle on"
                      : "toggle"
                  }
                  onClick={() =>
                    setForm({
                      ...form,
                      active:
                        !form.active,
                    })
                  }
                  disabled={saving}
                >
                  <span />
                </button>
              </div>

              {error && (
                <div className="form-error">
                  {error}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-button"
                  disabled={saving}
                >
                  {saving
                    ? "SAVING..."
                    : editingPrize
                    ? "SAVE CHANGES"
                    : "ADD PRIZE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          background: white;
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

        .dashboard {
          width: 100%;
          max-width: 1200px;
          margin: auto;
          padding: 42px 25px 60px;
          box-sizing: border-box;
        }

        .welcome {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
        }

        .eyebrow,
        .modal-eyebrow {
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

        .add-button {
          border: none;
          border-radius: 10px;
          padding: 12px 18px;
          background: #e31b23;
          color: white;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(227, 27, 35, 0.2);
          white-space: nowrap;
        }

        .add-button:hover {
          transform: translateY(-1px);
        }

        .success-message,
        .error-message {
          margin-top: 22px;
          padding: 12px 15px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
        }

        .success-message {
          background: #edf9f0;
          color: #24733b;
          border: 1px solid #ccebd3;
        }

        .error-message {
          background: #fff1f1;
          color: #c5161d;
          border: 1px solid #f4cccc;
        }

        /* =====================================================
           STAGE 3A - OVERVIEW
        ====================================================== */

        .overview-header {
          margin-top: 35px;
          margin-bottom: 16px;
        }

        .overview-header h2 {
          margin: 6px 0 4px;
          font-size: 21px;
        }

        .overview-header p {
          margin: 0;
          color: #888;
          font-size: 13px;
        }

        .overview-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
        }

        .overview-card {
          min-height: 125px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px;
          box-sizing: border-box;
          border-radius: 15px;
          background: white;
          border: 1px solid #eeeeee;
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.04);
        }

        .overview-icon {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #fff1f1;
          color: #e31b23;
          font-size: 22px;
          font-weight: 900;
        }

        .active-icon {
          background: #edf9f0;
          color: #24733b;
        }

        .inactive-icon {
          background: #f1f1f1;
          color: #888;
        }

        .weight-icon {
          background: #f5f5f5;
          color: #333;
        }

        .overview-label {
          color: #999;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .overview-value {
          margin-top: 4px;
          color: #222;
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
        }

        .overview-description {
          margin-top: 7px;
          color: #999;
          font-size: 10px;
        }

        .weight-info {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 15px;
          padding: 12px 15px;
          border: 1px solid #e8e8e8;
          border-radius: 10px;
          background: white;
        }

        .weight-info-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f0f0f0;
          color: #777;
          font-size: 11px;
          font-weight: 900;
        }

        .weight-info strong {
          color: #555;
          font-size: 11px;
        }

        .weight-info p {
          margin: 3px 0 0;
          color: #999;
          font-size: 10px;
        }

        /* =====================================================
           PRIZE MANAGEMENT
        ====================================================== */

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 35px 0 15px;
        }

        .section-header h2 {
          margin: 0 0 4px;
          font-size: 21px;
        }

        .section-header p {
          margin: 0;
          color: #888;
          font-size: 13px;
        }

        .prize-count {
          padding: 7px 11px;
          border-radius: 20px;
          background: white;
          color: #777;
          font-size: 11px;
          font-weight: 800;
          border: 1px solid #e5e5e5;
        }

        .table-card {
          overflow: hidden;
          border-radius: 16px;
          background: white;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        th {
          padding: 15px 18px;
          background: #fafafa;
          border-bottom: 1px solid #eee;
          color: #888;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          text-align: left;
        }

        td {
          padding: 17px 18px;
          border-bottom: 1px solid #f0f0f0;
          vertical-align: middle;
        }

        tr:last-child td {
          border-bottom: none;
        }

        .order-number {
          display: inline-flex;
          width: 30px;
          height: 30px;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #f5f5f5;
          color: #555;
          font-size: 12px;
          font-weight: 900;
        }

        .prize-name {
          color: #222;
          font-size: 14px;
          font-weight: 850;
        }

        .prize-description {
          margin-top: 4px;
          color: #999;
          font-size: 11px;
        }

        .weight {
          display: inline-flex;
          min-width: 42px;
          justify-content: center;
          padding: 7px 9px;
          border-radius: 7px;
          background: #f7f7f7;
          color: #333;
          font-size: 12px;
          font-weight: 900;
        }

        .coupon-prefix {
          display: inline-block;
          padding: 6px 9px;
          border-radius: 7px;
          background: #fff5f5;
          color: #c5161d;
          font-family: monospace;
          font-size: 11px;
          font-weight: 900;
        }

        .status {
          padding: 7px 10px;
          border: none;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .status.active {
          background: #edf9f0;
          color: #24733b;
        }

        .status.inactive {
          background: #f1f1f1;
          color: #888;
        }

        .actions {
          display: flex;
          gap: 7px;
        }

        .edit-button,
        .delete-button {
          padding: 7px 10px;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .edit-button {
          border: 1px solid #ddd;
          background: white;
          color: #444;
        }

        .delete-button {
          border: 1px solid #f0cccc;
          background: #fff7f7;
          color: #c5161d;
        }

        .delete-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading-box,
        .empty-box {
          padding: 60px 20px;
          border-radius: 16px;
          background: white;
          text-align: center;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
        }

        .loading-box {
          color: #888;
          font-size: 14px;
        }

        .empty-icon {
          font-size: 40px;
        }

        .empty-box h3 {
          margin: 15px 0 6px;
        }

        .empty-box p {
          margin: 0 0 20px;
          color: #888;
          font-size: 13px;
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

        /* =====================================================
           STAGE 3B - HISTORY
        ====================================================== */

        .history-section-header {
          margin-top: 42px;
        }

        .refresh-button {
          padding: 10px 14px;
          border: 1px solid #ddd;
          border-radius: 9px;
          background: white;
          color: #444;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
          white-space: nowrap;
        }

        .refresh-button:hover {
          background: #f8f8f8;
        }

        .refresh-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .history-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 15px;
        }

        .history-summary-card {
          min-height: 105px;
          padding: 18px;
          box-sizing: border-box;
          border-radius: 13px;
          background: white;
          border: 1px solid #eeeeee;
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.04);
        }

        .history-summary-label {
          color: #999;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .history-summary-value {
          margin-top: 7px;
          color: #222;
          font-size: 27px;
          line-height: 1;
          font-weight: 950;
        }

        .history-summary-latest {
          margin-top: 8px;
          color: #222;
          font-size: 14px;
          font-weight: 850;
        }

        .history-summary-description {
          margin-top: 7px;
          color: #999;
          font-size: 10px;
        }

        .history-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 15px;
          padding: 13px 15px;
          border: 1px solid #f2cccc;
          border-radius: 10px;
          background: #fff5f5;
          color: #c5161d;
        }

        .history-error strong {
          font-size: 12px;
        }

        .history-error p {
          margin: 3px 0 0;
          color: #d04444;
          font-size: 11px;
        }

        .history-error button {
          padding: 8px 12px;
          border: 1px solid #e5aaaa;
          border-radius: 7px;
          background: white;
          color: #c5161d;
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
          white-space: nowrap;
        }

        .history-table-card {
          margin-top: 0;
        }

        .history-date {
          color: #666;
          font-size: 11px;
          white-space: nowrap;
        }

        .history-mobile {
          color: #444;
          font-family: monospace;
          font-size: 11px;
          font-weight: 700;
        }

        .history-prize {
          color: #222;
          font-size: 13px;
          font-weight: 850;
        }

        .history-coupon {
          display: inline-block;
          padding: 6px 9px;
          border-radius: 7px;
          background: #fff5f5;
          color: #c5161d;
          font-family: monospace;
          font-size: 11px;
          font-weight: 900;
        }

        .history-status {
          display: inline-block;
          padding: 7px 10px;
          border-radius: 20px;
          font-size: 8px;
          font-weight: 900;
        }

        .history-status.issued {
          background: #edf9f0;
          color: #24733b;
        }

        .history-status.redeemed {
          background: #f0edff;
          color: #6351a8;
        }

        .history-status.unknown {
          background: #f1f1f1;
          color: #888;
        }

        .history-limit-note {
          margin-top: 9px;
          color: #aaa;
          font-size: 10px;
        }

        /* =====================================================
           MODAL
        ====================================================== */

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
          background: rgba(0, 0, 0, 0.48);
        }

        .modal {
          width: 100%;
          max-width: 560px;
          max-height: 92vh;
          overflow-y: auto;
          padding: 28px;
          box-sizing: border-box;
          border-radius: 20px;
          background: white;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.25);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 25px;
        }

        .modal-header h2 {
          margin: 5px 0 0;
          font-size: 25px;
        }

        .close-button {
          width: 34px;
          height: 34px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: white;
          color: #666;
          font-size: 22px;
          cursor: pointer;
        }

        .form-field {
          margin-bottom: 17px;
        }

        .form-field label {
          display: block;
          margin-bottom: 7px;
          color: #333;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .form-field input,
        .form-field textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 9px;
          background: white;
          color: #222;
          font-family: inherit;
          font-size: 14px;
          outline: none;
        }

        .form-field textarea {
          resize: vertical;
        }

        .form-field input:focus,
        .form-field textarea:focus {
          border-color: #e31b23;
          box-shadow: 0 0 0 3px rgba(227, 27, 35, 0.07);
        }

        .form-field small {
          display: block;
          margin-top: 5px;
          color: #999;
          font-size: 10px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .active-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin: 8px 0 20px;
          padding: 14px;
          border-radius: 10px;
          background: #f8f8f8;
        }

        .active-toggle strong {
          font-size: 13px;
        }

        .active-toggle p {
          margin: 3px 0 0;
          color: #888;
          font-size: 11px;
        }

        .toggle {
          width: 48px;
          height: 27px;
          padding: 3px;
          border: none;
          border-radius: 20px;
          background: #ccc;
          cursor: pointer;
          transition: 0.2s;
        }

        .toggle span {
          display: block;
          width: 21px;
          height: 21px;
          border-radius: 50%;
          background: white;
          transition: 0.2s;
        }

        .toggle.on {
          background: #e31b23;
        }

        .toggle.on span {
          transform: translateX(21px);
        }

        .form-error {
          margin-bottom: 15px;
          padding: 10px;
          border-radius: 8px;
          background: #fff1f1;
          color: #c5161d;
          font-size: 12px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 5px;
        }

        .cancel-button,
        .save-button {
          padding: 12px 17px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .cancel-button {
          border: 1px solid #ddd;
          background: white;
          color: #555;
        }

        .save-button {
          border: none;
          background: #e31b23;
          color: white;
        }

        .cancel-button:disabled,
        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* =====================================================
           MOBILE
        ====================================================== */

        @media (max-width: 950px) {
          .overview-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 650px) {
          .admin-header {
            padding: 12px 15px;
          }

          .admin-email {
            display: none;
          }

          .dashboard {
            padding: 30px 15px 50px;
          }

          .welcome {
            align-items: flex-start;
            flex-direction: column;
          }

          .welcome h1 {
            font-size: 28px;
          }

          .add-button {
            width: 100%;
          }

          .overview-grid {
            grid-template-columns: 1fr;
          }

          .overview-card {
            min-height: 105px;
          }

          .section-header {
            align-items: flex-start;
            gap: 10px;
          }

          .form-grid {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .modal {
            padding: 22px 18px;
            border-radius: 17px;
          }

          /* Stage 3B mobile */

          .history-summary {
            grid-template-columns: 1fr;
          }

          .history-section-header {
            align-items: flex-start;
          }

          .refresh-button {
            width: 100%;
          }

          .history-error {
            align-items: flex-start;
            flex-direction: column;
          }

          .history-error button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
