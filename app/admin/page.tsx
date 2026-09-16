"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type ActiveTab =
  | "overview"
  | "prizes"
  | "history"
  | "statistics";

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

const emptyPrizeForm: PrizeForm = {
  name: "",
  description: "",
  weight: "1",
  coupon_prefix: "SG",
  sort_order: "1",
  active: true,
};

/* =========================================================
   HELPERS
========================================================= */

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusClass(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized === "issued" ||
    normalized === "active"
  ) {
    return "history-status issued";
  }

  if (normalized === "redeemed") {
    return "history-status redeemed";
  }

  return "history-status other";
}

function isWithinDateFilter(
  value: string,
  filter: string
) {
  if (filter === "all") return true;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  if (filter === "today") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  const days = filter === "7days" ? 7 : 30;

  const cutoff = new Date();
  cutoff.setDate(now.getDate() - days);

  return date >= cutoff;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AdminPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] =
    useState(true);

  const [adminEmail, setAdminEmail] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("overview");

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  /* =======================================================
     PRIZES
  ======================================================= */

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingPrizes, setLoadingPrizes] =
    useState(true);

  const [showPrizeModal, setShowPrizeModal] =
    useState(false);

  const [editingPrize, setEditingPrize] =
    useState<Prize | null>(null);

  const [prizeForm, setPrizeForm] =
    useState<PrizeForm>(emptyPrizeForm);

  const [savingPrize, setSavingPrize] =
    useState(false);

  const [prizeError, setPrizeError] =
    useState("");

  const [prizeMessage, setPrizeMessage] =
    useState("");

  /* =======================================================
     HISTORY
  ======================================================= */

  const [history, setHistory] =
    useState<SpinHistory[]>([]);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [historyError, setHistoryError] =
    useState("");

  const [historySearch, setHistorySearch] =
    useState("");

  const [historyPrizeFilter, setHistoryPrizeFilter] =
    useState("all");

  const [historyStatusFilter, setHistoryStatusFilter] =
    useState("all");

  const [historyDateFilter, setHistoryDateFilter] =
    useState("all");

  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    setCheckingAuth(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/admin/login");
      return;
    }

    const { data: admin, error } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error || !admin) {
      await supabase.auth.signOut();
      router.replace("/admin/login");
      return;
    }

    setAdminEmail(user.email || "");
    setCheckingAuth(false);

    await loadPrizes();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  /* =======================================================
     LOAD PRIZES
  ======================================================= */

  async function loadPrizes() {
    setLoadingPrizes(true);

    const { data, error } =
      await supabase
        .from("prizes")
        .select(
          "id,name,description,weight,active,sort_order,coupon_prefix"
        )
        .order("sort_order", {
          ascending: true,
        });

    if (error) {
      console.error(error);
      setPrizeError(
        error.message || "Unable to load prizes."
      );
      setPrizes([]);
      setLoadingPrizes(false);
      return;
    }

    setPrizes((data || []) as Prize[]);
    setLoadingPrizes(false);
  }

  /* =======================================================
     LOAD HISTORY
  ======================================================= */

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

    const [
      prizesResult,
      couponsResult,
    ] = await Promise.all([
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

    const combined: SpinHistory[] =
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
            coupon?.status || "unknown",
        };
      });

    setHistory(combined);
    setLoadingHistory(false);
  }

  /* =======================================================
     TAB CHANGE
  ======================================================= */

  function changeTab(tab: ActiveTab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);

    if (tab === "history") {
      loadHistory();
    }
  }

  /* =======================================================
     PRIZE MODAL
  ======================================================= */

  function openAddPrize() {
    setEditingPrize(null);

    setPrizeForm({
      ...emptyPrizeForm,
      sort_order: String(
        prizes.length + 1
      ),
    });

    setPrizeError("");
    setPrizeMessage("");
    setShowPrizeModal(true);
  }

  function openEditPrize(prize: Prize) {
    setEditingPrize(prize);

    setPrizeForm({
      name: prize.name,
      description: prize.description || "",
      weight: String(prize.weight),
      coupon_prefix:
        prize.coupon_prefix || "SG",
      sort_order: String(
        prize.sort_order
      ),
      active: prize.active,
    });

    setPrizeError("");
    setPrizeMessage("");
    setShowPrizeModal(true);
  }

  function closePrizeModal() {
    if (savingPrize) return;

    setShowPrizeModal(false);
    setEditingPrize(null);
    setPrizeForm(emptyPrizeForm);
    setPrizeError("");
  }

  /* =======================================================
     SAVE PRIZE
  ======================================================= */

  async function handleSavePrize(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setPrizeError("");
    setPrizeMessage("");

    const name = prizeForm.name.trim();
    const description =
      prizeForm.description.trim();

    const weight = Number(
      prizeForm.weight
    );

    const sortOrder = Number(
      prizeForm.sort_order
    );

    const couponPrefix =
      prizeForm.coupon_prefix
        .trim()
        .toUpperCase();

    if (!name) {
      setPrizeError(
        "Please enter a prize name."
      );
      return;
    }

    if (
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      setPrizeError(
        "Weight must be a number greater than or equal to 0."
      );
      return;
    }

    if (
      !Number.isFinite(sortOrder) ||
      sortOrder < 1
    ) {
      setPrizeError(
        "Display order must be 1 or greater."
      );
      return;
    }

    if (!couponPrefix) {
      setPrizeError(
        "Please enter a coupon prefix."
      );
      return;
    }

    setSavingPrize(true);

    const payload = {
      name,
      description:
        description || null,
      weight,
      coupon_prefix: couponPrefix,
      sort_order: sortOrder,
      active: prizeForm.active,
    };

    let error;

    if (editingPrize) {
      const result =
        await supabase
          .from("prizes")
          .update(payload)
          .eq("id", editingPrize.id);

      error = result.error;
    } else {
      const result =
        await supabase
          .from("prizes")
          .insert(payload);

      error = result.error;
    }

    if (error) {
      console.error(error);

      setPrizeError(
        error.message ||
          "Unable to save prize."
      );

      setSavingPrize(false);
      return;
    }

    setPrizeMessage(
      editingPrize
        ? "Prize updated successfully."
        : "Prize added successfully."
    );

    await loadPrizes();

    setSavingPrize(false);
    setShowPrizeModal(false);
    setEditingPrize(null);
    setPrizeForm(emptyPrizeForm);
  }

  /* =======================================================
     DELETE PRIZE
  ======================================================= */

  async function handleDeletePrize(
    prize: Prize
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${prize.name}"?`
      );

    if (!confirmed) return;

    setPrizeError("");
    setPrizeMessage("");

    const { error } =
      await supabase
        .from("prizes")
        .delete()
        .eq("id", prize.id);

    if (error) {
      console.error(error);

      setPrizeError(
        error.message ||
          "Unable to delete prize."
      );

      return;
    }

    setPrizeMessage(
      "Prize deleted successfully."
    );

    await loadPrizes();
  }

  /* =======================================================
     ACTIVATE / DEACTIVATE
  ======================================================= */

  async function togglePrizeStatus(
    prize: Prize
  ) {
    setPrizeError("");
    setPrizeMessage("");

    const { error } =
      await supabase
        .from("prizes")
        .update({
          active: !prize.active,
        })
        .eq("id", prize.id);

    if (error) {
      console.error(error);

      setPrizeError(
        error.message ||
          "Unable to update prize status."
      );

      return;
    }

    setPrizeMessage(
      prize.active
        ? "Prize deactivated."
        : "Prize activated."
    );

    await loadPrizes();
  }

  /* =======================================================
     DERIVED PRIZE DATA
  ======================================================= */

  const activePrizes = useMemo(
    () =>
      prizes.filter(
        (prize) => prize.active
      ),
    [prizes]
  );

  const inactivePrizes = useMemo(
    () =>
      prizes.filter(
        (prize) => !prize.active
      ),
    [prizes]
  );

  const activeWinningWeight = useMemo(
    () =>
      activePrizes.reduce(
        (total, prize) =>
          total + Number(prize.weight || 0),
        0
      ),
    [activePrizes]
  );

  const totalPrizeWeight = useMemo(
    () =>
      prizes.reduce(
        (total, prize) =>
          total + Number(prize.weight || 0),
        0
      ),
    [prizes]
  );

  /* =======================================================
     FILTERED HISTORY
  ======================================================= */

  const filteredHistory = useMemo(() => {
    const search =
      historySearch
        .trim()
        .toLowerCase();

    return history.filter((record) => {
      const matchesSearch =
        !search ||
        record.mobile
          .toLowerCase()
          .includes(search) ||
        record.coupon_code
          .toLowerCase()
          .includes(search) ||
        record.prize_name
          .toLowerCase()
          .includes(search);

      const matchesPrize =
        historyPrizeFilter === "all" ||
        record.prize_id ===
          historyPrizeFilter;

      const matchesStatus =
        historyStatusFilter === "all" ||
        record.coupon_status.toLowerCase() ===
          historyStatusFilter.toLowerCase();

      const matchesDate =
        isWithinDateFilter(
          record.created_at,
          historyDateFilter
        );

      return (
        matchesSearch &&
        matchesPrize &&
        matchesStatus &&
        matchesDate
      );
    });
  }, [
    history,
    historySearch,
    historyPrizeFilter,
    historyStatusFilter,
    historyDateFilter,
  ]);

  function clearHistoryFilters() {
    setHistorySearch("");
    setHistoryPrizeFilter("all");
    setHistoryStatusFilter("all");
    setHistoryDateFilter("all");
  }

  /* =======================================================
     STATISTICS
  ======================================================= */

  const totalSpins = history.length;

  const issuedCoupons = history.filter(
    (record) =>
      record.coupon_status.toLowerCase() ===
      "issued"
  ).length;

  const redeemedCoupons = history.filter(
    (record) =>
      record.coupon_status.toLowerCase() ===
      "redeemed"
  ).length;

  const otherCouponStatuses =
    history.filter((record) => {
      const status =
        record.coupon_status.toLowerCase();

      return (
        status !== "issued" &&
        status !== "redeemed"
      );
    }).length;

  const prizeDistribution = useMemo(() => {
    const counts = new Map<
      string,
      {
        id: string;
        name: string;
        count: number;
      }
    >();

    for (const record of history) {
      const existing =
        counts.get(record.prize_id);

      if (existing) {
        existing.count += 1;
      } else {
        counts.set(record.prize_id, {
          id: record.prize_id,
          name: record.prize_name,
          count: 1,
        });
      }
    }

    return Array.from(
      counts.values()
    ).sort(
      (a, b) => b.count - a.count
    );
  }, [history]);

  const recentActivity =
    history.slice(0, 5);

  /* =======================================================
     AUTH LOADING
  ======================================================= */

  if (checkingAuth) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="spinner" />
          <p>
            Checking administrator access...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      <div className="admin-shell">

        {/* =================================================
            SIDEBAR
        ================================================= */}

        <aside
          className={`admin-sidebar ${
            mobileMenuOpen
              ? "mobile-open"
              : ""
          }`}
        >
          <div className="sidebar-brand">
            <div className="brand-mark">
              S
            </div>

            <div>
              <div className="brand-name">
                SINGHAGIRI
              </div>

              <div className="brand-subtitle">
                SPIN & WIN
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              className={
                activeTab === "overview"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                changeTab("overview")
              }
            >
              <span className="nav-icon">
                ▦
              </span>
              <span>Overview</span>
            </button>

            <button
              className={
                activeTab === "prizes"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                changeTab("prizes")
              }
            >
              <span className="nav-icon">
                ★
              </span>
              <span>Prize Management</span>
            </button>

            <button
              className={
                activeTab === "history"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                changeTab("history")
              }
            >
              <span className="nav-icon">
                ◷
              </span>
              <span>Winner History</span>
            </button>

            <button
              className={
                activeTab === "statistics"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                changeTab("statistics")
              }
            >
              <span className="nav-icon">
                ▥
              </span>
              <span>Statistics</span>
            </button>
          </nav>

          <div className="sidebar-bottom">
            <a
              href="/"
              className="view-site"
            >
              <span>↗</span>
              View Spin & Win
            </a>

            <button
              className="logout-button"
              onClick={handleLogout}
            >
              <span>⇥</span>
              Logout
            </button>
          </div>
        </aside>

        {/* =================================================
            MOBILE OVERLAY
        ================================================= */}

        {mobileMenuOpen && (
          <div
            className="mobile-overlay"
            onClick={() =>
              setMobileMenuOpen(false)
            }
          />
        )}

        {/* =================================================
            MAIN
        ================================================= */}

        <main className="admin-main">

          {/* HEADER */}

          <header className="admin-header">
            <div className="header-left">
              <button
                className="mobile-menu-button"
                onClick={() =>
                  setMobileMenuOpen(
                    !mobileMenuOpen
                  )
                }
              >
                ☰
              </button>

              <div>
                <h1>
                  {activeTab === "overview" &&
                    "Overview"}

                  {activeTab === "prizes" &&
                    "Prize Management"}

                  {activeTab === "history" &&
                    "Winner History"}

                  {activeTab === "statistics" &&
                    "Statistics"}
                </h1>

                <p>
                  Manage your Singhagiri Spin &
                  Win campaign
                </p>
              </div>
            </div>

            <div className="admin-user">
              <div className="user-avatar">
                {adminEmail
                  ? adminEmail
                      .charAt(0)
                      .toUpperCase()
                  : "A"}
              </div>

              <div className="user-details">
                <strong>
                  Administrator
                </strong>

                <span>
                  {adminEmail}
                </span>
              </div>
            </div>
          </header>

          <div className="admin-content">

            {/* =================================================
                GLOBAL MESSAGES
            ================================================= */}

            {prizeMessage && (
              <div className="success-alert">
                <span>✓</span>
                {prizeMessage}

                <button
                  onClick={() =>
                    setPrizeMessage("")
                  }
                >
                  ×
                </button>
              </div>
            )}

            {prizeError &&
              activeTab !== "prizes" && (
                <div className="error-alert">
                  <span>!</span>
                  {prizeError}

                  <button
                    onClick={() =>
                      setPrizeError("")
                    }
                  >
                    ×
                  </button>
                </div>
              )}

            {/* =================================================
                OVERVIEW
            ================================================= */}

            {activeTab === "overview" && (
              <section>
                <div className="page-intro">
                  <div>
                    <h2>
                      Campaign Overview
                    </h2>

                    <p>
                      Monitor your prizes,
                      winning probabilities
                      and campaign activity.
                    </p>
                  </div>

                  <button
                    className="primary-button"
                    onClick={() =>
                      changeTab("prizes")
                    }
                  >
                    Manage Prizes
                  </button>
                </div>

                <div className="stats-grid">

                  <div className="stat-card">
                    <div className="stat-icon">
                      ★
                    </div>

                    <div>
                      <span className="stat-label">
                        Total Prizes
                      </span>

                      <strong className="stat-value">
                        {prizes.length}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      ✓
                    </div>

                    <div>
                      <span className="stat-label">
                        Active Prizes
                      </span>

                      <strong className="stat-value">
                        {
                          activePrizes.length
                        }
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      ○
                    </div>

                    <div>
                      <span className="stat-label">
                        Inactive Prizes
                      </span>

                      <strong className="stat-value">
                        {
                          inactivePrizes.length
                        }
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      %
                    </div>

                    <div>
                      <span className="stat-label">
                        Active Weight
                      </span>

                      <strong className="stat-value">
                        {activeWinningWeight}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="overview-grid">

                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h3>
                          Prize Configuration
                        </h3>

                        <p>
                          Current active prize
                          setup.
                        </p>
                      </div>

                      <button
                        className="secondary-button"
                        onClick={() =>
                          changeTab("prizes")
                        }
                      >
                        View All
                      </button>
                    </div>

                    <div className="prize-summary-list">
                      {loadingPrizes ? (
                        <div className="empty-state">
                          Loading prizes...
                        </div>
                      ) : activePrizes.length ===
                        0 ? (
                        <div className="empty-state">
                          No active prizes.
                        </div>
                      ) : (
                        activePrizes.map(
                          (prize) => {
                            const probability =
                              activeWinningWeight >
                              0
                                ? (
                                    (Number(
                                      prize.weight
                                    ) /
                                      activeWinningWeight) *
                                    100
                                  ).toFixed(2)
                                : "0.00";

                            return (
                              <div
                                className="prize-summary-row"
                                key={prize.id}
                              >
                                <div>
                                  <strong>
                                    {prize.name}
                                  </strong>

                                  <span>
                                    Weight:{" "}
                                    {
                                      prize.weight
                                    }
                                  </span>
                                </div>

                                <div className="probability-badge">
                                  {probability}%
                                </div>
                              </div>
                            );
                          }
                        )
                      )}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h3>
                          Campaign Information
                        </h3>

                        <p>
                          Current system
                          statistics.
                        </p>
                      </div>
                    </div>

                    <div className="info-list">

                      <div className="info-row">
                        <span>
                          Total Spin Records
                        </span>

                        <strong>
                          {totalSpins}
                        </strong>
                      </div>

                      <div className="info-row">
                        <span>
                          Active Winning Weight
                        </span>

                        <strong>
                          {
                            activeWinningWeight
                          }
                        </strong>
                      </div>

                      <div className="info-row">
                        <span>
                          Total Configured
                          Weight
                        </span>

                        <strong>
                          {totalPrizeWeight}
                        </strong>
                      </div>

                      <div className="info-row">
                        <span>
                          Active Prizes
                        </span>

                        <strong>
                          {
                            activePrizes.length
                          }
                        </strong>
                      </div>

                    </div>
                  </div>
                </div>

                <div className="panel probability-panel">
                  <div className="panel-header">
                    <div>
                      <h3>
                        How Winning Probability
                        Works
                      </h3>

                      <p>
                        The server uses the
                        configured weight of each
                        active prize.
                      </p>
                    </div>
                  </div>

                  <div className="formula-box">
                    <strong>
                      Prize Probability
                    </strong>

                    <span>
                      Prize Weight ÷ Total Active
                      Weight × 100
                    </span>
                  </div>

                  <p className="helper-text">
                    Example: if an active prize
                    has a weight of 10 and the
                    total active weight is 100,
                    its theoretical probability
                    is 10%.
                  </p>
                </div>
              </section>
            )}

            {/* =================================================
                PRIZE MANAGEMENT
            ================================================= */}

            {activeTab === "prizes" && (
              <section>
                <div className="page-intro">
                  <div>
                    <h2>
                      Prize Management
                    </h2>

                    <p>
                      Configure prizes, weights,
                      coupon prefixes and
                      activation status.
                    </p>
                  </div>

                  <button
                    className="primary-button"
                    onClick={openAddPrize}
                  >
                    + Add Prize
                  </button>
                </div>

                {prizeError && (
                  <div className="error-alert">
                    <span>!</span>
                    {prizeError}

                    <button
                      onClick={() =>
                        setPrizeError("")
                      }
                    >
                      ×
                    </button>
                  </div>
                )}

                <div className="panel">

                  {loadingPrizes ? (
                    <div className="large-loading">
                      <div className="spinner" />
                      <p>
                        Loading prizes...
                      </p>
                    </div>
                  ) : prizes.length === 0 ? (
                    <div className="empty-state large">
                      <div className="empty-icon">
                        ★
                      </div>

                      <h3>
                        No prizes configured
                      </h3>

                      <p>
                        Add your first prize to
                        start configuring the
                        Spin & Win campaign.
                      </p>

                      <button
                        className="primary-button"
                        onClick={openAddPrize}
                      >
                        Add First Prize
                      </button>
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>
                              Order
                            </th>

                            <th>
                              Prize
                            </th>

                            <th>
                              Weight
                            </th>

                            <th>
                              Probability
                            </th>

                            <th>
                              Coupon Prefix
                            </th>

                            <th>
                              Status
                            </th>

                            <th>
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {prizes.map(
                            (prize) => {
                              const probability =
                                prize.active &&
                                activeWinningWeight >
                                  0
                                  ? (
                                      (Number(
                                        prize.weight
                                      ) /
                                        activeWinningWeight) *
                                      100
                                    ).toFixed(2)
                                  : "0.00";

                              return (
                                <tr
                                  key={
                                    prize.id
                                  }
                                >
                                  <td>
                                    <span className="order-badge">
                                      {
                                        prize.sort_order
                                      }
                                    </span>
                                  </td>

                                  <td>
                                    <div className="table-prize">
                                      <strong>
                                        {
                                          prize.name
                                        }
                                      </strong>

                                      {prize.description && (
                                        <span>
                                          {
                                            prize.description
                                          }
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td>
                                    <strong>
                                      {
                                        prize.weight
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    <span className="probability-badge">
                                      {probability}%
                                    </span>
                                  </td>

                                  <td>
                                    <code>
                                      {
                                        prize.coupon_prefix
                                      }
                                    </code>
                                  </td>

                                  <td>
                                    <span
                                      className={
                                        prize.active
                                          ? "status-badge active"
                                          : "status-badge inactive"
                                      }
                                    >
                                      {prize.active
                                        ? "Active"
                                        : "Inactive"}
                                    </span>
                                  </td>

                                  <td>
                                    <div className="action-buttons">

                                      <button
                                        className="small-button"
                                        onClick={() =>
                                          openEditPrize(
                                            prize
                                          )
                                        }
                                      >
                                        Edit
                                      </button>

                                      <button
                                        className="small-button"
                                        onClick={() =>
                                          togglePrizeStatus(
                                            prize
                                          )
                                        }
                                      >
                                        {prize.active
                                          ? "Deactivate"
                                          : "Activate"}
                                      </button>

                                      <button
                                        className="small-button danger"
                                        onClick={() =>
                                          handleDeletePrize(
                                            prize
                                          )
                                        }
                                      >
                                        Delete
                                      </button>

                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* =================================================
                WINNER HISTORY
            ================================================= */}

            {activeTab === "history" && (
              <section>
                <div className="page-intro">
                  <div>
                    <h2>
                      Winner History
                    </h2>

                    <p>
                      View spin activity,
                      winners and generated
                      coupon codes.
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={loadHistory}
                    disabled={loadingHistory}
                  >
                    {loadingHistory
                      ? "Refreshing..."
                      : "↻ Refresh"}
                  </button>
                </div>

                {historyError && (
                  <div className="error-alert">
                    <span>!</span>

                    {historyError}

                    <button
                      onClick={loadHistory}
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="panel">

                  {/* FILTERS */}

                  <div className="history-filters">

                    <div className="filter-group search-filter">
                      <label>
                        Search
                      </label>

                      <input
                        type="text"
                        value={
                          historySearch
                        }
                        onChange={(event) =>
                          setHistorySearch(
                            event.target.value
                          )
                        }
                        placeholder="Mobile, coupon or prize..."
                      />
                    </div>

                    <div className="filter-group">
                      <label>
                        Prize
                      </label>

                      <select
                        value={
                          historyPrizeFilter
                        }
                        onChange={(event) =>
                          setHistoryPrizeFilter(
                            event.target.value
                          )
                        }
                      >
                        <option value="all">
                          All Prizes
                        </option>

                        {prizes.map(
                          (prize) => (
                            <option
                              key={
                                prize.id
                              }
                              value={
                                prize.id
                              }
                            >
                              {prize.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="filter-group">
                      <label>
                        Coupon Status
                      </label>

                      <select
                        value={
                          historyStatusFilter
                        }
                        onChange={(event) =>
                          setHistoryStatusFilter(
                            event.target.value
                          )
                        }
                      >
                        <option value="all">
                          All Statuses
                        </option>

                        <option value="issued">
                          Issued
                        </option>

                        <option value="redeemed">
                          Redeemed
                        </option>
                      </select>
                    </div>

                    <div className="filter-group">
                      <label>
                        Date
                      </label>

                      <select
                        value={
                          historyDateFilter
                        }
                        onChange={(event) =>
                          setHistoryDateFilter(
                            event.target.value
                          )
                        }
                      >
                        <option value="all">
                          All Time
                        </option>

                        <option value="today">
                          Today
                        </option>

                        <option value="7days">
                          Last 7 Days
                        </option>

                        <option value="30days">
                          Last 30 Days
                        </option>
                      </select>
                    </div>

                    <div className="filter-actions">
                      <button
                        className="secondary-button"
                        onClick={
                          clearHistoryFilters
                        }
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="history-result-count">
                    Showing{" "}
                    <strong>
                      {
                        filteredHistory.length
                      }
                    </strong>{" "}
                    of{" "}
                    <strong>
                      {history.length}
                    </strong>{" "}
                    loaded records
                  </div>

                  {loadingHistory ? (
                    <div className="large-loading">
                      <div className="spinner" />

                      <p>
                        Loading winner history...
                      </p>
                    </div>
                  ) : filteredHistory.length ===
                    0 ? (
                    <div className="empty-state large">
                      <div className="empty-icon">
                        ◷
                      </div>

                      <h3>
                        No matching records
                      </h3>

                      <p>
                        No spin records match
                        your current filters.
                      </p>

                      <button
                        className="secondary-button"
                        onClick={
                          clearHistoryFilters
                        }
                      >
                        Clear Filters
                      </button>
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="admin-table history-table">
                        <thead>
                          <tr>
                            <th>
                              Date & Time
                            </th>

                            <th>
                              Mobile Number
                            </th>

                            <th>
                              Prize
                            </th>

                            <th>
                              Coupon Code
                            </th>

                            <th>
                              Status
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredHistory.map(
                            (record) => (
                              <tr
                                key={
                                  record.id
                                }
                              >
                                <td>
                                  <span className="date-text">
                                    {formatDateTime(
                                      record.created_at
                                    )}
                                  </span>
                                </td>

                                <td>
                                  <strong className="mobile-number">
                                    {record.mobile}
                                  </strong>
                                </td>

                                <td>
                                  <span className="winner-prize">
                                    {record.prize_name}
                                  </span>
                                </td>

                                <td>
                                  <code className="coupon-code">
                                    {
                                      record.coupon_code
                                    }
                                  </code>
                                </td>

                                <td>
                                  <span
                                    className={getStatusClass(
                                      record.coupon_status
                                    )}
                                  >
                                    {
                                      record.coupon_status
                                    }
                                  </span>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* =================================================
                STATISTICS
            ================================================= */}

            {activeTab === "statistics" && (
              <section>
                <div className="page-intro">
                  <div>
                    <h2>
                      Campaign Statistics
                    </h2>

                    <p>
                      Summary of the currently
                      loaded Spin & Win activity.
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={loadHistory}
                    disabled={loadingHistory}
                  >
                    {loadingHistory
                      ? "Refreshing..."
                      : "↻ Refresh Data"}
                  </button>
                </div>

                <div className="stats-grid">

                  <div className="stat-card">
                    <div className="stat-icon">
                      ◷
                    </div>

                    <div>
                      <span className="stat-label">
                        Total Spins
                      </span>

                      <strong className="stat-value">
                        {totalSpins}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      ✓
                    </div>

                    <div>
                      <span className="stat-label">
                        Coupons Issued
                      </span>

                      <strong className="stat-value">
                        {issuedCoupons}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      $
                    </div>

                    <div>
                      <span className="stat-label">
                        Redeemed
                      </span>

                      <strong className="stat-value">
                        {redeemedCoupons}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      %
                    </div>

                    <div>
                      <span className="stat-label">
                        Redemption Rate
                      </span>

                      <strong className="stat-value">
                        {issuedCoupons +
                          redeemedCoupons >
                        0
                          ? (
                              (redeemedCoupons /
                                (issuedCoupons +
                                  redeemedCoupons)) *
                              100
                            ).toFixed(1)
                          : "0.0"}
                        %
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="statistics-grid">

                  {/* PRIZE DISTRIBUTION */}

                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h3>
                          Winner Distribution
                        </h3>

                        <p>
                          Prize distribution from
                          the loaded history.
                        </p>
                      </div>
                    </div>

                    {prizeDistribution.length ===
                    0 ? (
                      <div className="empty-state">
                        No winner records
                        available.
                      </div>
                    ) : (
                      <div className="distribution-list">
                        {prizeDistribution.map(
                          (item) => {
                            const percentage =
                              totalSpins > 0
                                ? (
                                    (item.count /
                                      totalSpins) *
                                    100
                                  ).toFixed(1)
                                : "0.0";

                            return (
                              <div
                                className="distribution-item"
                                key={
                                  item.id
                                }
                              >
                                <div className="distribution-top">
                                  <strong>
                                    {item.name}
                                  </strong>

                                  <span>
                                    {item.count}{" "}
                                    winner
                                    {item.count !==
                                    1
                                      ? "s"
                                      : ""}
                                  </span>
                                </div>

                                <div className="progress-track">
                                  <div
                                    className="progress-bar"
                                    style={{
                                      width: `${percentage}%`,
                                    }}
                                  />
                                </div>

                                <div className="distribution-bottom">
                                  <span>
                                    {percentage}%
                                  </span>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>

                  {/* COUPON STATUS */}

                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h3>
                          Coupon Status
                        </h3>

                        <p>
                          Current coupon status
                          breakdown.
                        </p>
                      </div>
                    </div>

                    <div className="coupon-stat-list">

                      <div className="coupon-stat-row">
                        <div>
                          <span className="status-dot issued-dot" />
                          <span>
                            Issued
                          </span>
                        </div>

                        <strong>
                          {issuedCoupons}
                        </strong>
                      </div>

                      <div className="coupon-stat-row">
                        <div>
                          <span className="status-dot redeemed-dot" />
                          <span>
                            Redeemed
                          </span>
                        </div>

                        <strong>
                          {redeemedCoupons}
                        </strong>
                      </div>

                      {otherCouponStatuses >
                        0 && (
                        <div className="coupon-stat-row">
                          <div>
                            <span className="status-dot other-dot" />
                            <span>
                              Other
                            </span>
                          </div>

                          <strong>
                            {
                              otherCouponStatuses
                            }
                          </strong>
                        </div>
                      )}

                    </div>
                  </div>
                </div>

                {/* RECENT ACTIVITY */}

                <div className="panel recent-panel">
                  <div className="panel-header">
                    <div>
                      <h3>
                        Recent Activity
                      </h3>

                      <p>
                        Latest five spin
                        records.
                      </p>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={() =>
                        changeTab(
                          "history"
                        )
                      }
                    >
                      View Full History
                    </button>
                  </div>

                  {recentActivity.length ===
                  0 ? (
                    <div className="empty-state">
                      No recent activity.
                    </div>
                  ) : (
                    <div className="recent-list">
                      {recentActivity.map(
                        (record) => (
                          <div
                            className="recent-row"
                            key={
                              record.id
                            }
                          >
                            <div className="recent-icon">
                              ★
                            </div>

                            <div className="recent-main">
                              <strong>
                                {
                                  record.prize_name
                                }
                              </strong>

                              <span>
                                {
                                  record.mobile
                                }
                              </span>
                            </div>

                            <div className="recent-coupon">
                              <code>
                                {
                                  record.coupon_code
                                }
                              </code>

                              <span>
                                {formatDateTime(
                                  record.created_at
                                )}
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="statistics-note">
                  <strong>
                    Statistics note:
                  </strong>{" "}
                  Winner History currently
                  loads the latest 100 spin
                  records. Therefore the
                  distribution and coupon
                  statistics on this page are
                  based on those loaded records.
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* =====================================================
          PRIZE MODAL
      ===================================================== */}

      {showPrizeModal && (
        <div className="modal-overlay">
          <div className="prize-modal">

            <div className="modal-header">
              <div>
                <h2>
                  {editingPrize
                    ? "Edit Prize"
                    : "Add Prize"}
                </h2>

                <p>
                  Configure the prize and its
                  winning probability.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={closePrizeModal}
                disabled={savingPrize}
              >
                ×
              </button>
            </div>

            {prizeError && (
              <div className="error-alert">
                <span>!</span>
                {prizeError}
              </div>
            )}

            <form
              onSubmit={handleSavePrize}
              className="prize-form"
            >

              <div className="form-group">
                <label>
                  Prize Name
                </label>

                <input
                  type="text"
                  value={
                    prizeForm.name
                  }
                  onChange={(event) =>
                    setPrizeForm({
                      ...prizeForm,
                      name: event.target.value,
                    })
                  }
                  placeholder="e.g. 10% OFF"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Description
                </label>

                <textarea
                  value={
                    prizeForm.description
                  }
                  onChange={(event) =>
                    setPrizeForm({
                      ...prizeForm,
                      description:
                        event.target.value,
                    })
                  }
                  placeholder="Optional prize description"
                  rows={3}
                />
              </div>

              <div className="form-grid">

                <div className="form-group">
                  <label>
                    Weight
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      prizeForm.weight
                    }
                    onChange={(event) =>
                      setPrizeForm({
                        ...prizeForm,
                        weight:
                          event.target.value,
                      })
                    }
                    required
                  />

                  <small>
                    Higher weight =
                    higher probability.
                  </small>
                </div>

                <div className="form-group">
                  <label>
                    Display Order
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      prizeForm.sort_order
                    }
                    onChange={(event) =>
                      setPrizeForm({
                        ...prizeForm,
                        sort_order:
                          event.target.value,
                      })
                    }
                    required
                  />
                </div>

              </div>

              <div className="form-group">
                <label>
                  Coupon Prefix
                </label>

                <input
                  type="text"
                  value={
                    prizeForm.coupon_prefix
                  }
                  onChange={(event) =>
                    setPrizeForm({
                      ...prizeForm,
                      coupon_prefix:
                        event.target.value
                          .toUpperCase(),
                    })
                  }
                  placeholder="SG10"
                  maxLength={20}
                  required
                />

                <small>
                  Example: SG10, SG20, GIFT
                </small>
              </div>

              <div className="active-toggle">
                <div>
                  <strong>
                    Prize Status
                  </strong>

                  <span>
                    {prizeForm.active
                      ? "This prize can be won."
                      : "This prize is disabled."}
                  </span>
                </div>

                <button
                  type="button"
                  className={
                    prizeForm.active
                      ? "toggle active"
                      : "toggle"
                  }
                  onClick={() =>
                    setPrizeForm({
                      ...prizeForm,
                      active:
                        !prizeForm.active,
                    })
                  }
                >
                  <span />
                </button>
              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closePrizeModal
                  }
                  disabled={savingPrize}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingPrize}
                >
                  {savingPrize
                    ? "Saving..."
                    : editingPrize
                    ? "Update Prize"
                    : "Add Prize"}
                </button>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          STYLES
      ===================================================== */}

      <style jsx global>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f5f6f8;
          color: #171717;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .loading-screen {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f6f8;
        }

        .loading-card {
          background: #fff;
          border-radius: 18px;
          padding: 40px;
          text-align: center;
          box-shadow:
            0 10px 35px
            rgba(0, 0, 0, 0.08);
        }

        .spinner {
          width: 34px;
          height: 34px;
          border: 3px solid #e5e5e5;
          border-top-color: #e31b23;
          border-radius: 50%;
          animation:
            spin 0.8s linear infinite;
          margin: 0 auto 15px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .admin-shell {
          min-height: 100vh;
          display: flex;
          background: #f5f6f8;
        }

        /* SIDEBAR */

        .admin-sidebar {
          width: 255px;
          min-height: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          z-index: 100;
          background: #151515;
          color: #fff;
          display: flex;
          flex-direction: column;
          padding: 26px 16px;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding:
            0 10px 28px;
          border-bottom:
            1px solid
            rgba(255, 255, 255, 0.1);
        }

        .brand-mark {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e31b23;
          border-radius: 10px;
          font-size: 23px;
          font-weight: 900;
        }

        .brand-name {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .brand-subtitle {
          color: #aaa;
          font-size: 10px;
          letter-spacing: 1.5px;
          margin-top: 3px;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-top: 25px;
        }

        .nav-item {
          border: 0;
          background: transparent;
          color: #aaa;
          width: 100%;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 13px;
          padding:
            13px 14px;
          border-radius: 9px;
          transition: 0.2s;
          font-size: 14px;
        }

        .nav-item:hover {
          background: #242424;
          color: #fff;
        }

        .nav-item.active {
          background: #e31b23;
          color: #fff;
          font-weight: 700;
        }

        .nav-icon {
          width: 20px;
          text-align: center;
          font-size: 16px;
        }

        .sidebar-bottom {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding-top: 20px;
        }

        .view-site,
        .logout-button {
          border: 0;
          background: transparent;
          color: #aaa;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 12px;
          padding:
            11px 14px;
          border-radius: 8px;
          font-size: 13px;
          text-align: left;
        }

        .view-site:hover,
        .logout-button:hover {
          background: #242424;
          color: #fff;
        }

        /* MAIN */

        .admin-main {
          width: calc(100% - 255px);
          margin-left: 255px;
          min-height: 100vh;
        }

        .admin-header {
          height: 82px;
          background: #fff;
          border-bottom:
            1px solid #e8e8e8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding:
            0 34px;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .admin-header h1 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.3px;
        }

        .admin-header p {
          margin: 4px 0 0;
          color: #777;
          font-size: 12px;
        }

        .admin-user {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .user-avatar {
          width: 38px;
          height: 38px;
          background: #f0f0f0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #333;
        }

        .user-details {
          display: flex;
          flex-direction: column;
        }

        .user-details strong {
          font-size: 12px;
        }

        .user-details span {
          color: #888;
          font-size: 11px;
          margin-top: 2px;
        }

        .admin-content {
          padding:
            32px 34px 50px;
          max-width: 1600px;
        }

        .mobile-menu-button {
          display: none;
          border: 0;
          background: #f2f2f2;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          font-size: 20px;
        }

        .mobile-overlay {
          display: none;
        }

        /* INTRO */

        .page-intro {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 25px;
        }

        .page-intro h2 {
          margin: 0;
          font-size: 23px;
        }

        .page-intro p {
          margin:
            6px 0 0;
          color: #777;
          font-size: 13px;
        }

        /* BUTTONS */

        .primary-button,
        .secondary-button,
        .small-button {
          border-radius: 8px;
          font-weight: 700;
          transition: 0.2s;
        }

        .primary-button {
          border: 0;
          background: #e31b23;
          color: #fff;
          padding:
            11px 17px;
          font-size: 13px;
        }

        .primary-button:hover {
          background: #c9141b;
        }

        .secondary-button {
          border:
            1px solid #ddd;
          background: #fff;
          color: #333;
          padding:
            10px 15px;
          font-size: 12px;
        }

        .secondary-button:hover {
          border-color: #bbb;
          background: #fafafa;
        }

        .small-button {
          border:
            1px solid #ddd;
          background: #fff;
          color: #444;
          padding:
            7px 10px;
          font-size: 11px;
        }

        .small-button:hover {
          background: #f4f4f4;
        }

        .small-button.danger {
          color: #d71920;
          border-color: #f1c5c7;
        }

        /* ALERTS */

        .success-alert,
        .error-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 9px;
          padding:
            12px 14px;
          margin-bottom: 18px;
          font-size: 13px;
        }

        .success-alert {
          background: #edf9f0;
          color: #1c6b31;
          border:
            1px solid #cbe9d1;
        }

        .error-alert {
          background: #fff0f0;
          color: #a71920;
          border:
            1px solid #f1c9cb;
        }

        .success-alert button,
        .error-alert button {
          margin-left: auto;
          border: 0;
          background: transparent;
          color: inherit;
          font-weight: 700;
        }

        /* STATS */

        .stats-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 17px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: #fff;
          border:
            1px solid #e9e9e9;
          border-radius: 14px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .stat-icon {
          width: 45px;
          height: 45px;
          border-radius: 11px;
          background: #f9e8e9;
          color: #e31b23;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
          font-weight: 800;
        }

        .stat-label {
          display: block;
          color: #777;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 25px;
        }

        /* PANELS */

        .panel {
          background: #fff;
          border:
            1px solid #e9e9e9;
          border-radius: 14px;
          margin-bottom: 20px;
          overflow: hidden;
        }

        .overview-grid,
        .statistics-grid {
          display: grid;
          grid-template-columns:
            1.3fr 1fr;
          gap: 20px;
        }

        .overview-grid .panel,
        .statistics-grid .panel {
          margin-bottom: 20px;
        }

        .panel-header {
          padding:
            20px 21px;
          border-bottom:
            1px solid #eee;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 15px;
        }

        .panel-header p {
          margin:
            4px 0 0;
          color: #888;
          font-size: 11px;
        }

        /* PRIZE SUMMARY */

        .prize-summary-list {
          padding:
            5px 20px;
        }

        .prize-summary-row {
          min-height: 65px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          border-bottom:
            1px solid #f0f0f0;
        }

        .prize-summary-row:last-child {
          border-bottom: 0;
        }

        .prize-summary-row div:first-child {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .prize-summary-row strong {
          font-size: 13px;
        }

        .prize-summary-row span {
          color: #888;
          font-size: 11px;
        }

        .probability-badge {
          background: #f5f5f5;
          color: #333 !important;
          border-radius: 20px;
          padding:
            5px 9px;
          font-size: 11px !important;
          font-weight: 700;
          white-space: nowrap;
        }

        /* INFO */

        .info-list {
          padding:
            8px 20px 15px;
        }

        .info-row {
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom:
            1px solid #f0f0f0;
          font-size: 12px;
        }

        .info-row:last-child {
          border-bottom: 0;
        }

        .info-row span {
          color: #777;
        }

        /* PROBABILITY */

        .probability-panel {
          padding-bottom: 20px;
        }

        .formula-box {
          margin:
            20px 20px 10px;
          background: #f7f7f7;
          border-radius: 10px;
          padding: 17px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .formula-box strong {
          font-size: 12px;
        }

        .formula-box span {
          font-family: monospace;
          font-size: 12px;
          color: #555;
        }

        .helper-text {
          padding:
            0 20px;
          color: #777;
          font-size: 11px;
          line-height: 1.6;
        }

        /* TABLE */

        .table-wrapper {
          overflow-x: auto;
          width: 100%;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }

        .admin-table th {
          background: #fafafa;
          text-align: left;
          padding:
            12px 15px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #777;
          border-bottom:
            1px solid #eee;
          white-space: nowrap;
        }

        .admin-table td {
          padding:
            15px;
          border-bottom:
            1px solid #f0f0f0;
          font-size: 12px;
          vertical-align: middle;
        }

        .admin-table tbody tr:hover {
          background: #fcfcfc;
        }

        .table-prize {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .table-prize strong {
          font-size: 13px;
        }

        .table-prize span {
          color: #888;
          font-size: 10px;
          max-width: 240px;
        }

        .order-badge {
          width: 27px;
          height: 27px;
          background: #f2f2f2;
          border-radius: 7px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
        }

        code {
          background: #f3f3f3;
          border-radius: 5px;
          padding:
            4px 7px;
          font-family:
            "Courier New",
            monospace;
          font-size: 11px;
        }

        .status-badge {
          display: inline-flex;
          padding:
            5px 9px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
        }

        .status-badge.active {
          background: #eaf8ee;
          color: #21743a;
        }

        .status-badge.inactive {
          background: #f2f2f2;
          color: #777;
        }

        .action-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        /* HISTORY */

        .history-filters {
          padding:
            18px 20px;
          display: grid;
          grid-template-columns:
            2fr 1fr 1fr 1fr auto;
          gap: 10px;
          border-bottom:
            1px solid #eee;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .filter-group label {
          color: #777;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .filter-group input,
        .filter-group select {
          height: 38px;
          border:
            1px solid #ddd;
          border-radius: 7px;
          padding:
            0 10px;
          background: #fff;
          outline: none;
          font-size: 12px;
        }

        .filter-group input:focus,
        .filter-group select:focus {
          border-color: #e31b23;
        }

        .filter-actions {
          display: flex;
          align-items: flex-end;
        }

        .history-result-count {
          padding:
            12px 20px;
          color: #777;
          font-size: 11px;
          border-bottom:
            1px solid #f0f0f0;
        }

        .history-result-count strong {
          color: #222;
        }

        .mobile-number {
          font-family:
            "Courier New",
            monospace;
          letter-spacing: 0.2px;
          white-space: nowrap;
        }

        .winner-prize {
          font-weight: 700;
        }

        .coupon-code {
          color: #222;
          font-weight: 700;
        }

        .history-status {
          display: inline-flex;
          border-radius: 20px;
          padding:
            5px 9px;
          font-size: 10px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .history-status.issued {
          background: #eaf8ee;
          color: #21743a;
        }

        .history-status.redeemed {
          background: #e8f0ff;
          color: #2755a5;
        }

        .history-status.other {
          background: #f3f3f3;
          color: #777;
        }

        .date-text {
          color: #666;
          white-space: nowrap;
        }

        /* EMPTY */

        .empty-state {
          padding:
            35px 20px;
          text-align: center;
          color: #777;
        }

        .empty-state.large {
          padding:
            65px 20px;
        }

        .empty-icon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #f4f4f4;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 15px;
          color: #999;
          font-size: 20px;
        }

        .empty-state h3 {
          margin:
            0 0 7px;
          color: #333;
          font-size: 15px;
        }

        .empty-state p {
          margin:
            0 0 18px;
          font-size: 12px;
        }

        .large-loading {
          min-height: 250px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #777;
          font-size: 12px;
        }

        /* STATISTICS */

        .distribution-list {
          padding:
            15px 20px 20px;
        }

        .distribution-item {
          margin-bottom: 20px;
        }

        .distribution-item:last-child {
          margin-bottom: 0;
        }

        .distribution-top {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .distribution-top span {
          color: #777;
        }

        .progress-track {
          width: 100%;
          height: 8px;
          background: #eee;
          border-radius: 10px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: #e31b23;
          border-radius: 10px;
          min-width: 2px;
        }

        .distribution-bottom {
          margin-top: 5px;
          color: #777;
          font-size: 10px;
          text-align: right;
        }

        .coupon-stat-list {
          padding:
            10px 20px 20px;
        }

        .coupon-stat-row {
          min-height: 55px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom:
            1px solid #f0f0f0;
          font-size: 12px;
        }

        .coupon-stat-row:last-child {
          border-bottom: 0;
        }

        .coupon-stat-row > div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .issued-dot {
          background: #38a169;
        }

        .redeemed-dot {
          background: #3676d6;
        }

        .other-dot {
          background: #999;
        }

        .recent-panel {
          overflow: hidden;
        }

        .recent-list {
          padding:
            5px 20px 10px;
        }

        .recent-row {
          min-height: 70px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom:
            1px solid #f0f0f0;
        }

        .recent-row:last-child {
          border-bottom: 0;
        }

        .recent-icon {
          width: 35px;
          height: 35px;
          border-radius: 9px;
          background: #f9e8e9;
          color: #e31b23;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .recent-main {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .recent-main strong {
          font-size: 12px;
        }

        .recent-main span {
          color: #777;
          font-size: 10px;
          font-family:
            "Courier New",
            monospace;
        }

        .recent-coupon {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
        }

        .recent-coupon span {
          color: #999;
          font-size: 9px;
        }

        .statistics-note {
          background: #fff9e8;
          border:
            1px solid #f2df9c;
          color: #725b13;
          border-radius: 9px;
          padding:
            13px 15px;
          font-size: 11px;
          line-height: 1.5;
        }

        /* MODAL */

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          background:
            rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .prize-modal {
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          overflow-y: auto;
          background: #fff;
          border-radius: 15px;
          box-shadow:
            0 25px 70px
            rgba(0, 0, 0, 0.2);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding:
            22px 23px;
          border-bottom:
            1px solid #eee;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .modal-header p {
          margin:
            5px 0 0;
          color: #888;
          font-size: 11px;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 7px;
          background: #f2f2f2;
          color: #555;
          font-size: 20px;
        }

        .prize-form {
          padding: 22px;
        }

        .form-group {
          margin-bottom: 17px;
        }

        .form-group label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          border:
            1px solid #ddd;
          border-radius: 8px;
          padding:
            10px 11px;
          outline: none;
          font-size: 12px;
          background: #fff;
        }

        .form-group textarea {
          resize: vertical;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          border-color: #e31b23;
        }

        .form-group small {
          display: block;
          color: #999;
          font-size: 10px;
          margin-top: 5px;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 14px;
        }

        .active-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding:
            13px 14px;
          background: #f8f8f8;
          border-radius: 9px;
          margin-bottom: 20px;
        }

        .active-toggle > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .active-toggle strong {
          font-size: 12px;
        }

        .active-toggle span {
          color: #888;
          font-size: 10px;
        }

        .toggle {
          width: 45px;
          height: 25px;
          padding: 3px;
          border: 0;
          border-radius: 20px;
          background: #ccc;
          position: relative;
          transition: 0.2s;
        }

        .toggle span {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 19px;
          height: 19px;
          border-radius: 50%;
          background: #fff;
          transition: 0.2s;
        }

        .toggle.active {
          background: #e31b23;
        }

        .toggle.active span {
          left: 23px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding-top: 5px;
        }

        /* RESPONSIVE */

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .overview-grid,
          .statistics-grid {
            grid-template-columns: 1fr;
          }

          .history-filters {
            grid-template-columns:
              1fr 1fr;
          }

          .search-filter {
            grid-column:
              1 / -1;
          }

          .filter-actions {
            align-items: center;
          }
        }

        @media (max-width: 800px) {

          .admin-sidebar {
            transform:
              translateX(-100%);
            transition:
              transform 0.25s ease;
          }

          .admin-sidebar.mobile-open {
            transform:
              translateX(0);
          }

          .mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 90;
            background:
              rgba(0, 0, 0, 0.45);
          }

          .admin-main {
            width: 100%;
            margin-left: 0;
          }

          .mobile-menu-button {
            display: block;
          }

          .admin-header {
            padding:
              0 18px;
          }

          .user-details {
            display: none;
          }

          .admin-content {
            padding:
              22px 18px 40px;
          }

          .page-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          .page-intro .primary-button,
          .page-intro .secondary-button {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 550px) {

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .history-filters {
            grid-template-columns: 1fr;
          }

          .search-filter {
            grid-column:
              auto;
          }

          .filter-actions {
            justify-content: flex-start;
          }

          .filter-actions button {
            width: 100%;
          }

          .form-grid {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .modal-overlay {
            padding: 10px;
          }

          .prize-modal {
            max-height: 95vh;
          }

          .recent-row {
            align-items: flex-start;
            padding:
              12px 0;
          }

          .recent-coupon {
            display: none;
          }

          .admin-header h1 {
            font-size: 18px;
          }

          .admin-header p {
            display: none;
          }
        }

      `}</style>
    </>
  );
}
