"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type ActiveTab = "overview" | "prizes" | "history";

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

type SpinRow = {
  id: string;
  mobile: string;
  prize_id: string;
  coupon_id: string;
  created_at: string;
};

type CouponInfo = {
  code: string;
  status: string;
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

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("overview");

  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(false);

  const [history, setHistory] = useState<SpinHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingPrize, setEditingPrize] =
    useState<Prize | null>(null);
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

    const { data: admin, error: adminError } =
      await supabase
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
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      console.error(error);
      setError("Unable to load prizes.");
      setLoadingPrizes(false);
      return;
    }

    setPrizes((data || []) as Prize[]);
    setLoadingPrizes(false);
  }

  async function loadHistory() {
    setLoadingHistory(true);
    setHistoryError("");

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
      console.error(spinsError);
      setHistoryError(
        spinsError.message ||
          "Unable to load spin history."
      );
      setHistory([]);
      setLoadingHistory(false);
      return;
    }

    const spins = (spinsData || []) as SpinRow[];

    if (spins.length === 0) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }

    const prizeIds = Array.from(
      new Set(
        spins
          .map((spin) => spin.prize_id)
          .filter(Boolean)
      )
    );

    const couponIds = Array.from(
      new Set(
        spins
          .map((spin) => spin.coupon_id)
          .filter(Boolean)
      )
    );

    const [prizesResult, couponsResult] =
      await Promise.all([
        supabase
          .from("prizes")
          .select("id,name")
          .in("id", prizeIds),

        supabase
          .from("coupons")
          .select("id,code,status")
          .in("id", couponIds),
      ]);

    if (prizesResult.error) {
      console.error(prizesResult.error);

      setHistoryError(
        prizesResult.error.message ||
          "Unable to load prize information."
      );

      setHistory([]);
      setLoadingHistory(false);
      return;
    }

    if (couponsResult.error) {
      console.error(couponsResult.error);

      setHistoryError(
        couponsResult.error.message ||
          "Unable to load coupon information."
      );

      setHistory([]);
      setLoadingHistory(false);
      return;
    }

    const prizeMap = new Map(
      (prizesResult.data || []).map(
        (prize) => [prize.id, prize.name]
      )
    );

    const couponMap = new Map<
      string,
      CouponInfo
    >(
      (couponsResult.data || []).map(
        (coupon) => [
          coupon.id,
          {
            code: coupon.code,
            status: coupon.status,
          },
        ]
      )
    );

    const combined: SpinHistory[] = spins.map(
      (spin) => {
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
            coupon?.status || "unknown",
        };
      }
    );

    setHistory(combined);
    setLoadingHistory(false);
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
      coupon_prefix:
        prize.coupon_prefix || "",
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

  async function savePrize(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    const name = form.name.trim();
    const description =
      form.description.trim();

    const couponPrefix =
      form.coupon_prefix
        .trim()
        .toUpperCase();

    const weight = Number(form.weight);
    const sortOrder = Number(form.sort_order);

    if (!name) {
      setError("Please enter a prize name.");
      return;
    }

    if (
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      setError(
        "Weight must be 0 or greater."
      );
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
      setError(
        "Please enter a coupon prefix."
      );
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
          description:
            description || null,
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

      setMessage(
        "Prize updated successfully."
      );
    } else {
      const { error } = await supabase
        .from("prizes")
        .insert({
          name,
          description:
            description || null,
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

      setMessage(
        "Prize added successfully."
      );
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
        !prize.active
          ? "active"
          : "inactive"
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

  function selectTab(tab: ActiveTab) {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
    setMessage("");
    setError("");
  }

  function maskMobile(mobile: string) {
    if (!mobile) return "-";

    if (mobile.length <= 6) {
      return mobile;
    }

    return `${mobile.slice(
      0,
      4
    )}••••${mobile.slice(-3)}`;
  }

  function formatDateTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString(
      "en-LK",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  function getStatusClass(status: string) {
    const normalized =
      status.toLowerCase();

    if (
      normalized === "issued" ||
      normalized === "active"
    ) {
      return "history-status issued";
    }

    if (
      normalized === "redeemed"
    ) {
      return "history-status redeemed";
    }

    return "history-status other";
  }

  const totalPrizes = prizes.length;

  const activePrizes = prizes.filter(
    (prize) => prize.active
  ).length;

  const inactivePrizes = prizes.filter(
    (prize) => !prize.active
  ).length;

  const totalWinningWeight =
    prizes.reduce(
      (total, prize) =>
        total +
        Number(prize.weight || 0),
      0
    );

  const activeWinningWeight =
    prizes
      .filter((prize) => prize.active)
      .reduce(
        (total, prize) =>
          total +
          Number(prize.weight || 0),
        0
      );

  const totalSpins = history.length;

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

          <button
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <aside
          className={`sidebar ${
            mobileSidebarOpen
              ? "sidebar-open"
              : ""
          }`}
        >
          <div className="sidebar-brand">
            <div className="sidebar-mark">
              S
            </div>

            <div>
              <div className="sidebar-name">
                SINGHAGIRI
              </div>

              <div className="sidebar-subtitle">
                SPIN & WIN
              </div>
            </div>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-label">
            CAMPAIGN
          </div>

          <nav className="sidebar-nav">
            <button
              className={
                activeTab === "overview"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                selectTab("overview")
              }
            >
              <span className="nav-icon">
                ◈
              </span>

              <span>
                Overview
              </span>
            </button>

            <button
              className={
                activeTab === "prizes"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                selectTab("prizes")
              }
            >
              <span className="nav-icon">
                🎁
              </span>

              <span>
                Prize Management
              </span>
            </button>

            <button
              className={
                activeTab === "history"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                selectTab("history")
              }
            >
              <span className="nav-icon">
                🏆
              </span>

              <span>
                Winner History
              </span>
            </button>
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-divider" />

            <button
              className="sidebar-action"
              onClick={() =>
                router.push("/")
              }
            >
              <span>↩</span>
              <span>
                View Spin & Win
              </span>
            </button>

            <button
              className="sidebar-action logout-action"
              onClick={logout}
            >
              <span>⇥</span>
              <span>
                Logout
              </span>
            </button>
          </div>
        </aside>

        {mobileSidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() =>
              setMobileSidebarOpen(false)
            }
          />
        )}

        <section className="admin-content">
          <div className="mobile-toolbar">
            <button
              className="mobile-menu-button"
              onClick={() =>
                setMobileSidebarOpen(
                  !mobileSidebarOpen
                )
              }
            >
              ☰
            </button>

            <div>
              <div className="mobile-toolbar-title">
                SINGHAGIRI
              </div>

              <div className="mobile-toolbar-subtitle">
                SPIN & WIN ADMIN
              </div>
            </div>
          </div>

          {activeTab === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    ADMINISTRATION
                  </div>

                  <h1>
                    Spin & Win Dashboard
                  </h1>

                  <p>
                    Manage and monitor your
                    Singhagiri Spin & Win
                    campaign.
                  </p>
                </div>
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

              <div className="overview-header">
                <div>
                  <div className="eyebrow">
                    CAMPAIGN OVERVIEW
                  </div>

                  <h2>
                    Campaign Summary
                  </h2>

                  <p>
                    Quick summary of your
                    current Spin & Win
                    configuration.
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
                      Currently available
                      on wheel
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
                      Total active winning
                      weight
                    </div>
                  </div>
                </div>
              </div>

              <div className="overview-grid secondary-overview">
                <div className="overview-card">
                  <div className="overview-icon spin-icon">
                    ↻
                  </div>

                  <div className="overview-content">
                    <div className="overview-label">
                      TOTAL SPINS
                    </div>

                    <div className="overview-value">
                      {totalSpins}
                    </div>

                    <div className="overview-description">
                      Recorded spins
                    </div>
                  </div>
                </div>

                <div className="overview-card">
                  <div className="overview-icon weight-icon">
                    ∑
                  </div>

                  <div className="overview-content">
                    <div className="overview-label">
                      TOTAL WEIGHT
                    </div>

                    <div className="overview-value">
                      {totalWinningWeight}
                    </div>

                    <div className="overview-description">
                      All prize weights
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
                    Each active prize's
                    probability is
                    calculated from its
                    weight relative to the
                    total active weight.
                  </p>
                </div>
              </div>

              <div className="quick-actions">
                <div className="quick-actions-header">
                  <div>
                    <div className="eyebrow">
                      QUICK ACTIONS
                    </div>

                    <h2>
                      Campaign Management
                    </h2>
                  </div>
                </div>

                <div className="quick-actions-grid">
                  <button
                    className="quick-action-card"
                    onClick={() =>
                      selectTab("prizes")
                    }
                  >
                    <span className="quick-action-icon">
                      🎁
                    </span>

                    <span>
                      <strong>
                        Manage Prizes
                      </strong>

                      <small>
                        Add, edit and control
                        campaign prizes
                      </small>
                    </span>

                    <span className="quick-arrow">
                      →
                    </span>
                  </button>

                  <button
                    className="quick-action-card"
                    onClick={() =>
                      selectTab("history")
                    }
                  >
                    <span className="quick-action-icon">
                      🏆
                    </span>

                    <span>
                      <strong>
                        View Winners
                      </strong>

                      <small>
                        Review recent spins
                        and coupon codes
                      </small>
                    </span>

                    <span className="quick-arrow">
                      →
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "prizes" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    CAMPAIGN MANAGEMENT
                  </div>

                  <h1>
                    Prize Management
                  </h1>

                  <p>
                    Control prizes, winning
                    weights and coupon
                    settings.
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

              <div className="section-header">
                <div>
                  <div className="eyebrow">
                    PRIZE CONFIGURATION
                  </div>

                  <h2>
                    Prize List
                  </h2>

                  <p>
                    Manage all available
                    Spin & Win prizes.
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
                    Add your first Spin &
                    Win prize to get
                    started.
                  </p>

                  <button
                    className="add-button"
                    onClick={
                      openAddForm
                    }
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
                          <th>
                            ORDER
                          </th>

                          <th>
                            PRIZE
                          </th>

                          <th>
                            WEIGHT
                          </th>

                          <th>
                            COUPON
                          </th>

                          <th>
                            STATUS
                          </th>

                          <th>
                            ACTIONS
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {prizes.map(
                          (prize) => (
                            <tr
                              key={
                                prize.id
                              }
                            >
                              <td>
                                <span className="order-number">
                                  {
                                    prize.sort_order
                                  }
                                </span>
                              </td>

                              <td>
                                <div className="prize-name">
                                  {
                                    prize.name
                                  }
                                </div>

                                {prize.description && (
                                  <div className="prize-description">
                                    {
                                      prize.description
                                    }
                                  </div>
                                )}
                              </td>

                              <td>
                                <span className="weight">
                                  {
                                    prize.weight
                                  }
                                </span>
                              </td>

                              <td>
                                <span className="coupon-prefix">
                                  {prize.coupon_prefix ||
                                    "-"}
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
                                    togglePrize(
                                      prize
                                    )
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
                                      openEditForm(
                                        prize
                                      )
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
                                      deletePrize(
                                        prize
                                      )
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
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="weight-info">
                <div className="weight-info-icon">
                  ℹ
                </div>

                <div>
                  <strong>
                    Winning probability
                  </strong>

                  <p>
                    Higher weight means a
                    higher chance of the
                    prize being selected.
                    Only active prizes
                    participate in the
                    winning calculation.
                  </p>
                </div>
              </div>
            </>
          )}

          {activeTab === "history" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    WINNER ACTIVITY
                  </div>

                  <h1>
                    Spin & Winner History
                  </h1>

                  <p>
                    View recent spins,
                    winners and issued
                    coupon codes.
                  </p>
                </div>

                <button
                  className="refresh-button"
                  onClick={loadHistory}
                  disabled={
                    loadingHistory
                  }
                >
                  {loadingHistory
                    ? "Refreshing..."
                    : "↻ Refresh"}
                </button>
              </div>

              {historyError && (
                <div className="history-error">
                  <div>
                    <strong>
                      Unable to load
                      history
                    </strong>

                    <p>
                      {historyError}
                    </p>
                  </div>

                  <button
                    onClick={
                      loadHistory
                    }
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className="history-summary">
                <div className="history-summary-card">
                  <div className="history-summary-icon">
                    ↻
                  </div>

                  <div>
                    <div className="overview-label">
                      RECENT SPINS
                    </div>

                    <div className="history-summary-value">
                      {history.length}
                    </div>

                    <div className="overview-description">
                      Latest 100 records
                    </div>
                  </div>
                </div>
              </div>

              {loadingHistory ? (
                <div className="history-loading">
                  <div className="history-loader">
                    ↻
                  </div>

                  <h3>
                    Loading winner
                    history...
                  </h3>

                  <p>
                    Please wait while the
                    latest spin records are
                    loaded.
                  </p>
                </div>
              ) : history.length === 0 ? (
                <div className="history-empty">
                  <div className="history-empty-icon">
                    🏆
                  </div>

                  <h3>
                    No spin history
                  </h3>

                  <p>
                    Spin records will appear
                    here when customers
                    participate in the
                    campaign.
                  </p>
                </div>
              ) : (
                <div className="history-table-card">
                  <div className="history-table-wrapper">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>
                            DATE & TIME
                          </th>

                          <th>
                            MOBILE
                          </th>

                          <th>
                            PRIZE
                          </th>

                          <th>
                            COUPON
                          </th>

                          <th>
                            STATUS
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {history.map(
                          (record) => (
                            <tr
                              key={
                                record.id
                              }
                            >
                              <td>
                                <div className="history-date">
                                  {formatDateTime(
                                    record.created_at
                                  )}
                                </div>
                              </td>

                              <td>
                                <span className="history-mobile">
                                  {maskMobile(
                                    record.mobile
                                  )}
                                </span>
                              </td>

                              <td>
                                <div className="history-prize">
                                  {
                                    record.prize_name
                                  }
                                </div>
                              </td>

                              <td>
                                <span className="history-coupon">
                                  {
                                    record.coupon_code
                                  }
                                </span>
                              </td>

                              <td>
                                <span
                                  className={getStatusClass(
                                    record.coupon_status
                                  )}
                                >
                                  {record.coupon_status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="history-note">
                <div className="weight-info-icon">
                  ℹ
                </div>

                <div>
                  <strong>
                    Winner history
                  </strong>

                  <p>
                    This page displays the
                    latest 100 recorded
                    spins. Customer mobile
                    numbers are partially
                    masked for privacy.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

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

            <form
              onSubmit={savePrize}
            >
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
                    Higher weight = higher
                    chance.
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
                  Example:
                  SG10-XXXXXXXX
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
          position: relative;
          z-index: 50;
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

        .admin-layout {
          display: flex;
          min-height: calc(100vh - 70px);
        }

        .sidebar {
          width: 245px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          padding: 25px 15px;
          background: #181818;
          color: white;
          position: sticky;
          top: 0;
          height: calc(100vh - 70px);
          overflow-y: auto;
          z-index: 40;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 4px 9px 18px;
        }

        .sidebar-mark {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #e31b23;
          color: white;
          font-size: 22px;
          font-weight: 950;
        }

        .sidebar-name {
          color: white;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: 1px;
        }

        .sidebar-subtitle {
          margin-top: 2px;
          color: #e31b23;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1.8px;
        }

        .sidebar-divider {
          height: 1px;
          margin: 0 5px 22px;
          background: rgba(255, 255, 255, 0.09);
        }

        .sidebar-label {
          padding: 0 12px 9px;
          color: #777;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 12px;
          box-sizing: border-box;
          border: 1px solid transparent;
          border-radius: 9px;
          background: transparent;
          color: #aaa;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          text-align: left;
          cursor: pointer;
          transition: 0.2s;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }

        .nav-item.active {
          background: rgba(227, 27, 35, 0.13);
          border-color: rgba(227, 27, 35, 0.2);
          color: white;
        }

        .nav-icon {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.05);
          font-size: 12px;
        }

        .nav-item.active .nav-icon {
          background: #e31b23;
          color: white;
        }

        .sidebar-bottom {
          margin-top: auto;
        }

        .sidebar-bottom .sidebar-divider {
          margin-top: 25px;
        }

        .sidebar-action {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 12px;
          border: none;
          border-radius: 9px;
          background: transparent;
          color: #999;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }

        .sidebar-action:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }

        .logout-action:hover {
          color: #ff6b70;
        }

        .admin-content {
          width: 100%;
          max-width: 1250px;
          margin: 0 auto;
          padding: 42px 35px 70px;
          box-sizing: border-box;
        }

        .page-heading {
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

        .page-heading h1 {
          margin: 7px 0 5px;
          font-size: 34px;
          font-weight: 950;
        }

        .page-heading p {
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

        .secondary-overview {
          grid-template-columns: repeat(2, 1fr);
          margin-top: 15px;
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

        .spin-icon {
          background: #fff5f5;
          color: #e31b23;
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

        .quick-actions {
          margin-top: 35px;
        }

        .quick-actions-header {
          margin-bottom: 15px;
        }

        .quick-actions-header h2 {
          margin: 6px 0 0;
          font-size: 21px;
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }

        .quick-action-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px;
          border: 1px solid #e8e8e8;
          border-radius: 14px;
          background: white;
          color: #222;
          text-align: left;
          cursor: pointer;
          transition: 0.2s;
        }

        .quick-action-card:hover {
          border-color: #e31b23;
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.06);
        }

        .quick-action-icon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #fff1f1;
          font-size: 19px;
        }

        .quick-action-card span:nth-child(2) {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .quick-action-card strong {
          font-size: 13px;
        }

        .quick-action-card small {
          color: #999;
          font-size: 10px;
        }

        .quick-arrow {
          margin-left: auto;
          color: #aaa;
          font-size: 18px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 35px 0 15px;
        }

        .section-header h2 {
          margin: 6px 0 4px;
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
          white-space: nowrap;
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

        .refresh-button {
          padding: 11px 16px;
          border: 1px solid #ddd;
          border-radius: 9px;
          background: white;
          color: #444;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .refresh-button:hover {
          border-color: #bbb;
          background: #fafafa;
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .history-summary {
          display: grid;
          grid-template-columns: 250px;
          margin-top: 30px;
        }

        .history-summary-card {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 16px;
          border: 1px solid #e8e8e8;
          border-radius: 14px;
          background: white;
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.04);
        }

        .history-summary-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #fff1f1;
          color: #e31b23;
          font-size: 21px;
          font-weight: 900;
        }

        .history-summary-value {
          margin-top: 3px;
          font-size: 25px;
          font-weight: 950;
          line-height: 1;
        }

        .history-table-card {
          margin-top: 18px;
          overflow: hidden;
          border-radius: 16px;
          background: white;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
        }

        .history-table-wrapper {
          overflow-x: auto;
        }

        .history-table {
          min-width: 850px;
        }

        .history-date {
          color: #555;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .history-mobile {
          display: inline-block;
          padding: 6px 9px;
          border-radius: 7px;
          background: #f7f7f7;
          color: #555;
          font-family: monospace;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .history-prize {
          color: #222;
          font-size: 13px;
          font-weight: 850;
        }

        .history-coupon {
          display: inline-block;
          padding: 7px 10px;
          border-radius: 7px;
          background: #fff5f5;
          color: #c5161d;
          font-family: monospace;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .history-status {
          display: inline-block;
          padding: 7px 10px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
        }

        .history-status.issued {
          background: #edf9f0;
          color: #24733b;
        }

        .history-status.redeemed {
          background: #fff5e8;
          color: #a76400;
        }

        .history-status.other {
          background: #f1f1f1;
          color: #777;
        }

        .history-loading,
        .history-empty {
          margin-top: 18px;
          padding: 65px 20px;
          border-radius: 16px;
          background: white;
          text-align: center;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
        }

        .history-loader {
          width: 45px;
          height: 45px;
          margin: 0 auto 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fff1f1;
          color: #e31b23;
          font-size: 22px;
          font-weight: 900;
        }

        .history-loading h3,
        .history-empty h3 {
          margin: 0 0 6px;
          font-size: 16px;
        }

        .history-loading p,
        .history-empty p {
          margin: 0;
          color: #888;
          font-size: 12px;
        }

        .history-empty-icon {
          font-size: 42px;
          margin-bottom: 13px;
        }

        .history-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 22px;
          padding: 14px 16px;
          border: 1px solid #f4cccc;
          border-radius: 10px;
          background: #fff1f1;
          color: #c5161d;
        }

        .history-error strong {
          font-size: 12px;
        }

        .history-error p {
          margin: 4px 0 0;
          color: #a85b5f;
          font-size: 11px;
        }

        .history-error button {
          flex-shrink: 0;
          padding: 8px 13px;
          border: 1px solid #e5bcbc;
          border-radius: 7px;
          background: white;
          color: #c5161d;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .history-note {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 15px;
          padding: 12px 15px;
          border: 1px solid #e8e8e8;
          border-radius: 10px;
          background: white;
        }

        .history-note strong {
          color: #555;
          font-size: 11px;
        }

        .history-note p {
          margin: 3px 0 0;
          color: #999;
          font-size: 10px;
        }

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

        .mobile-toolbar {
          display: none;
        }

        .sidebar-overlay {
          display: none;
        }

        @media (max-width: 1100px) {
          .overview-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .sidebar {
            width: 220px;
          }
        }

        @media (max-width: 800px) {
          .admin-header {
            min-height: 60px;
            padding: 10px 15px;
          }

          .admin-header .header-brand {
            display: none;
          }

          .admin-layout {
            min-height: calc(100vh - 60px);
          }

          .sidebar {
            position: fixed;
            left: 0;
            top: 60px;
            bottom: 0;
            height: auto;
            width: 270px;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            box-shadow: 15px 0 50px rgba(0, 0, 0, 0.18);
          }

          .sidebar.sidebar-open {
            transform: translateX(0);
          }

          .sidebar-overlay {
            display: block;
            position: fixed;
            inset: 60px 0 0;
            z-index: 30;
            background: rgba(0, 0, 0, 0.4);
          }

          .admin-content {
            padding: 20px 15px 50px;
          }

          .mobile-toolbar {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 25px;
          }

          .mobile-menu-button {
            width: 40px;
            height: 40px;
            border: 1px solid #ddd;
            border-radius: 9px;
            background: white;
            color: #333;
            font-size: 20px;
            cursor: pointer;
          }

          .mobile-toolbar-title {
            font-size: 14px;
            font-weight: 950;
            letter-spacing: 0.7px;
          }

          .mobile-toolbar-subtitle {
            margin-top: 2px;
            color: #e31b23;
            font-size: 7px;
            font-weight: 900;
            letter-spacing: 1.5px;
          }

          .page-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .page-heading h1 {
            font-size: 28px;
          }

          .page-heading .add-button,
          .page-heading .refresh-button {
            width: 100%;
          }

          .quick-actions-grid {
            grid-template-columns: 1fr;
          }

          .history-summary {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .admin-email {
            display: none;
          }

          .header-right button {
            padding: 8px 12px;
          }

          .overview-grid,
          .secondary-overview {
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
