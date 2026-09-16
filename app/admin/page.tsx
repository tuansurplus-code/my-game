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

type StatisticsData = {
  totalSpins: number;
  totalCoupons: number;
  issuedCoupons: number;
  redeemedCoupons: number;
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
  const [loadingPrizes, setLoadingPrizes] =
    useState(false);

  const [history, setHistory] = useState<SpinHistory[]>(
    []
  );
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

  const [statistics, setStatistics] =
    useState<StatisticsData>({
      totalSpins: 0,
      totalCoupons: 0,
      issuedCoupons: 0,
      redeemedCoupons: 0,
    });

  const [loadingStatistics, setLoadingStatistics] =
    useState(false);
  const [statisticsError, setStatisticsError] =
    useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingPrize, setEditingPrize] =
    useState<Prize | null>(null);
  const [form, setForm] =
    useState<PrizeForm>(emptyForm);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] =
    useState<string | null>(null);

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

    const {
      data: admin,
      error: adminError,
    } = await supabase
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
      loadStatistics(),
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

    const {
      data: spinsData,
      error: spinsError,
    } = await supabase
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

  async function loadStatistics() {
    setLoadingStatistics(true);
    setStatisticsError("");

    const [
      spinsCountResult,
      couponsCountResult,
      couponsStatusResult,
    ] = await Promise.all([
      supabase
        .from("spins")
        .select("id", {
          count: "exact",
          head: true,
        }),

      supabase
        .from("coupons")
        .select("id", {
          count: "exact",
          head: true,
        }),

      supabase
        .from("coupons")
        .select("id,status"),
    ]);

    if (spinsCountResult.error) {
      console.error(spinsCountResult.error);

      setStatisticsError(
        spinsCountResult.error.message ||
          "Unable to load spin statistics."
      );

      setLoadingStatistics(false);
      return;
    }

    if (couponsCountResult.error) {
      console.error(
        couponsCountResult.error
      );

      setStatisticsError(
        couponsCountResult.error.message ||
          "Unable to load coupon statistics."
      );

      setLoadingStatistics(false);
      return;
    }

    if (couponsStatusResult.error) {
      console.error(
        couponsStatusResult.error
      );

      setStatisticsError(
        couponsStatusResult.error.message ||
          "Unable to load coupon status statistics."
      );

      setLoadingStatistics(false);
      return;
    }

    const coupons =
      couponsStatusResult.data || [];

    const issuedCoupons = coupons.filter(
      (coupon) =>
        String(coupon.status).toLowerCase() ===
        "issued"
    ).length;

    const redeemedCoupons = coupons.filter(
      (coupon) =>
        String(coupon.status).toLowerCase() ===
        "redeemed"
    ).length;

    setStatistics({
      totalSpins:
        spinsCountResult.count || 0,
      totalCoupons:
        couponsCountResult.count || 0,
      issuedCoupons,
      redeemedCoupons,
    });

    setLoadingStatistics(false);
  }

  function openAddForm() {
    setEditingPrize(null);

    setForm({
      ...emptyForm,
      sort_order: String(
        prizes.length + 1
      ),
    });

    setMessage("");
    setError("");
    setShowForm(true);
  }

  function openEditForm(prize: Prize) {
    setEditingPrize(prize);

    setForm({
      name: prize.name,
      description:
        prize.description || "",
      weight: String(prize.weight),
      coupon_prefix:
        prize.coupon_prefix || "",
      sort_order: String(
        prize.sort_order
      ),
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
    const sortOrder = Number(
      form.sort_order
    );

    if (!name) {
      setError(
        "Please enter a prize name."
      );
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
          coupon_prefix:
            couponPrefix,
        })
        .eq(
          "id",
          editingPrize.id
        );

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
          coupon_prefix:
            couponPrefix,
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
    await loadStatistics();
  }

  async function togglePrize(
    prize: Prize
  ) {
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

  async function deletePrize(
    prize: Prize
  ) {
    const confirmed =
      window.confirm(
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

  function selectTab(
    tab: ActiveTab
  ) {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
    setMessage("");
    setError("");

    if (tab === "history") {
      loadHistory();
    }

    if (tab === "statistics") {
      loadStatistics();
      loadHistory();
    }
  }

  function clearHistoryFilters() {
    setHistorySearch("");
    setHistoryPrizeFilter("all");
    setHistoryStatusFilter("all");
    setHistoryDateFilter("all");
  }

  function isWithinDateFilter(
    value: string,
    filter: string
  ) {
    if (filter === "all") {
      return true;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const now = new Date();

    if (filter === "today") {
      return (
        date.getFullYear() ===
          now.getFullYear() &&
        date.getMonth() ===
          now.getMonth() &&
        date.getDate() ===
          now.getDate()
      );
    }

    const days =
      filter === "7days"
        ? 7
        : filter === "30days"
        ? 30
        : 0;

    if (days === 0) {
      return true;
    }

    const cutoff = new Date(
      now.getTime()
    );

    cutoff.setDate(
      cutoff.getDate() - days
    );

    return date >= cutoff;
  }

  const filteredHistory = useMemo(() => {
    const search =
      historySearch
        .trim()
        .toLowerCase();

    return history.filter(
      (record) => {
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
          historyPrizeFilter ===
            "all" ||
          record.prize_id ===
            historyPrizeFilter;

        const matchesStatus =
          historyStatusFilter ===
            "all" ||
          record.coupon_status
            .toLowerCase() ===
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
      }
    );
  }, [
    history,
    historySearch,
    historyPrizeFilter,
    historyStatusFilter,
    historyDateFilter,
  ]);

  const prizeDistribution =
    useMemo(() => {
      const distribution = prizes.map(
        (prize) => {
          const count =
            history.filter(
              (record) =>
                record.prize_id ===
                prize.id
            ).length;

          return {
            id: prize.id,
            name: prize.name,
            count,
          };
        }
      );

      return distribution
        .filter(
          (item) => item.count > 0
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );
    }, [history, prizes]);

  const totalDistributionSpins =
    prizeDistribution.reduce(
      (total, item) =>
        total + item.count,
      0
    );

  const totalPrizes = prizes.length;

  const activePrizes =
    prizes.filter(
      (prize) => prize.active
    ).length;

  const inactivePrizes =
    prizes.filter(
      (prize) => !prize.active
    ).length;

  const totalWinningWeight =
    prizes.reduce(
      (total, prize) =>
        total +
        Number(
          prize.weight || 0
        ),
      0
    );

  const activeWinningWeight =
    prizes
      .filter(
        (prize) => prize.active
      )
      .reduce(
        (total, prize) =>
          total +
          Number(
            prize.weight || 0
          ),
        0
      );

  const issuedPercentage =
    statistics.totalCoupons > 0
      ? Math.round(
          (statistics.issuedCoupons /
            statistics.totalCoupons) *
            100
        )
      : 0;

  const redeemedPercentage =
    statistics.totalCoupons > 0
      ? Math.round(
          (statistics.redeemedCoupons /
            statistics.totalCoupons) *
            100
        )
      : 0;

  if (checking) {
    return (
      <main className="loading">
        <div>
          <div className="loader-mark">
            S
          </div>

          <p>
            Checking administrator
            access...
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
      <aside
        className={
          mobileSidebarOpen
            ? "sidebar open"
            : "sidebar"
        }
      >
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <div className="logo-mark">
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

          <button
            className="mobile-close"
            onClick={() =>
              setMobileSidebarOpen(false)
            }
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <div className="sidebar-label">
          ADMIN PANEL
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
            <span>Overview</span>
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

          <button
            className={
              activeTab === "statistics"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              selectTab("statistics")
            }
          >
            <span className="nav-icon">
              📊
            </span>
            <span>Statistics</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="admin-user">
            <div className="user-avatar">
              {email
                ? email
                    .charAt(0)
                    .toUpperCase()
                : "A"}
            </div>

            <div className="user-details">
              <div className="user-label">
                ADMINISTRATOR
              </div>

              <div className="user-email">
                {email || "Admin"}
              </div>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            <span>↪</span>
            Logout
          </button>
        </div>
      </aside>

      {mobileSidebarOpen && (
        <button
          className="sidebar-overlay"
          onClick={() =>
            setMobileSidebarOpen(false)
          }
          aria-label="Close sidebar"
        />
      )}

      <section className="main-area">
        <header className="admin-header">
          <div className="header-left">
            <button
              className="mobile-menu"
              onClick={() =>
                setMobileSidebarOpen(true)
              }
              aria-label="Open menu"
            >
              ☰
            </button>

            <div>
              <h1>
                {activeTab ===
                  "overview" &&
                  "Dashboard Overview"}

                {activeTab ===
                  "prizes" &&
                  "Prize Management"}

                {activeTab ===
                  "history" &&
                  "Winner History"}

                {activeTab ===
                  "statistics" &&
                  "Statistics"}
              </h1>

              <p>
                Manage your Singhagiri
                Spin & Win campaign
              </p>
            </div>
          </div>

          <div className="header-right">
            <div className="header-email">
              {email}
            </div>

            <div className="header-status">
              <span className="status-dot" />
              System Active
            </div>
          </div>
        </header>

        <div className="content">
          {message && (
            <div className="alert success">
              <span>✓</span>
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="alert error">
              <span>!</span>
              <span>{error}</span>
            </div>
          )}

          {activeTab === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <h2>
                    Campaign Overview
                  </h2>

                  <p>
                    Current configuration
                    of your Spin & Win
                    campaign.
                  </p>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">
                    🎁
                  </div>

                  <div>
                    <div className="stat-label">
                      TOTAL PRIZES
                    </div>

                    <div className="stat-value">
                      {totalPrizes}
                    </div>

                    <div className="stat-note">
                      All configured
                      prizes
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon green">
                    ✓
                  </div>

                  <div>
                    <div className="stat-label">
                      ACTIVE PRIZES
                    </div>

                    <div className="stat-value">
                      {activePrizes}
                    </div>

                    <div className="stat-note">
                      Currently available
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon gray">
                    ○
                  </div>

                  <div>
                    <div className="stat-label">
                      INACTIVE PRIZES
                    </div>

                    <div className="stat-value">
                      {inactivePrizes}
                    </div>

                    <div className="stat-note">
                      Not available
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon red">
                    🎯
                  </div>

                  <div>
                    <div className="stat-label">
                      ACTIVE WEIGHT
                    </div>

                    <div className="stat-value">
                      {activeWinningWeight}
                    </div>

                    <div className="stat-note">
                      Total winning
                      weight
                    </div>
                  </div>
                </div>
              </div>

              <div className="two-column">
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>
                        Winning Probability
                      </h3>

                      <p>
                        Probability is
                        calculated from
                        the active prize
                        weights.
                      </p>
                    </div>
                  </div>

                  <div className="probability-list">
                    {prizes.length ===
                    0 ? (
                      <div className="empty-state small">
                        No prizes
                        configured.
                      </div>
                    ) : (
                      prizes.map(
                        (prize) => {
                          const weight =
                            Number(
                              prize.weight ||
                                0
                            );

                          const probability =
                            prize.active &&
                            activeWinningWeight >
                              0
                              ? (weight /
                                  activeWinningWeight) *
                                100
                              : 0;

                          return (
                            <div
                              className="probability-row"
                              key={
                                prize.id
                              }
                            >
                              <div className="probability-main">
                                <div
                                  className={
                                    prize.active
                                      ? "prize-dot active"
                                      : "prize-dot"
                                  }
                                />

                                <div>
                                  <div className="probability-name">
                                    {
                                      prize.name
                                    }
                                  </div>

                                  <div className="probability-weight">
                                    Weight:{" "}
                                    {
                                      prize.weight
                                    }
                                  </div>
                                </div>
                              </div>

                              <div className="probability-value">
                                {prize.active
                                  ? `${probability.toFixed(
                                      2
                                    )}%`
                                  : "Inactive"}
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
                        Campaign Summary
                      </h3>

                      <p>
                        Current system
                        configuration.
                      </p>
                    </div>
                  </div>

                  <div className="summary-list">
                    <div className="summary-row">
                      <span>
                        Total prize
                        weight
                      </span>

                      <strong>
                        {totalWinningWeight}
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>
                        Active prize
                        weight
                      </span>

                      <strong>
                        {
                          activeWinningWeight
                        }
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>
                        Total spins
                      </span>

                      <strong>
                        {
                          statistics.totalSpins
                        }
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>
                        Total coupons
                      </span>

                      <strong>
                        {
                          statistics.totalCoupons
                        }
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>
                        Issued coupons
                      </span>

                      <strong>
                        {
                          statistics.issuedCoupons
                        }
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>
                        Redeemed coupons
                      </span>

                      <strong>
                        {
                          statistics.redeemedCoupons
                        }
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="quick-actions">
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>
                        Quick Actions
                      </h3>

                      <p>
                        Common campaign
                        management
                        actions.
                      </p>
                    </div>
                  </div>

                  <div className="action-grid">
                    <button
                      className="action-card"
                      onClick={() =>
                        selectTab(
                          "prizes"
                        )
                      }
                    >
                      <span>
                        🎁
                      </span>

                      <div>
                        <strong>
                          Manage Prizes
                        </strong>

                        <small>
                          Add, edit and
                          control prize
                          availability.
                        </small>
                      </div>
                    </button>

                    <button
                      className="action-card"
                      onClick={() =>
                        selectTab(
                          "history"
                        )
                      }
                    >
                      <span>
                        🏆
                      </span>

                      <div>
                        <strong>
                          Winner History
                        </strong>

                        <small>
                          View customer
                          winners and
                          coupons.
                        </small>
                      </div>
                    </button>

                    <button
                      className="action-card"
                      onClick={() =>
                        selectTab(
                          "statistics"
                        )
                      }
                    >
                      <span>
                        📊
                      </span>

                      <div>
                        <strong>
                          View Statistics
                        </strong>

                        <small>
                          Monitor campaign
                          performance.
                        </small>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "prizes" && (
            <>
              <div className="page-heading">
                <div>
                  <h2>
                    Prize Management
                  </h2>

                  <p>
                    Configure prizes,
                    weights and coupon
                    prefixes.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={openAddForm}
                >
                  <span>+</span>
                  Add Prize
                </button>
              </div>

              {loadingPrizes ? (
                <div className="panel loading-panel">
                  <div className="spinner" />
                  <p>
                    Loading prizes...
                  </p>
                </div>
              ) : prizes.length ===
                0 ? (
                <div className="panel empty-panel">
                  <div className="empty-icon">
                    🎁
                  </div>

                  <h3>
                    No prizes found
                  </h3>

                  <p>
                    Add your first prize
                    to start configuring
                    the wheel.
                  </p>

                  <button
                    className="primary-button"
                    onClick={
                      openAddForm
                    }
                  >
                    Add First Prize
                  </button>
                </div>
              ) : (
                <div className="panel">
                  <div className="table-wrapper">
                    <table className="data-table">
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
                                ? (Number(
                                    prize.weight
                                  ) /
                                    activeWinningWeight) *
                                  100
                                : 0;

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
                                      <small>
                                        {
                                          prize.description
                                        }
                                      </small>
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
                                  {prize.active
                                    ? `${probability.toFixed(
                                        2
                                      )}%`
                                    : "-"}
                                </td>

                                <td>
                                  <span className="coupon-prefix">
                                    {prize.coupon_prefix ||
                                      "-"}
                                  </span>
                                </td>

                                <td>
                                  <span
                                    className={
                                      prize.active
                                        ? "status-badge active"
                                        : "status-badge inactive"
                                    }
                                  >
                                    <span />
                                    {prize.active
                                      ? "Active"
                                      : "Inactive"}
                                  </span>
                                </td>

                                <td>
                                  <div className="table-actions">
                                    <button
                                      className="small-button edit"
                                      onClick={() =>
                                        openEditForm(
                                          prize
                                        )
                                      }
                                    >
                                      Edit
                                    </button>

                                    <button
                                      className={
                                        prize.active
                                          ? "small-button warning"
                                          : "small-button success"
                                      }
                                      onClick={() =>
                                        togglePrize(
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
                                        deletePrize(
                                          prize
                                        )
                                      }
                                      disabled={
                                        deleting ===
                                        prize.id
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
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "history" && (
            <>
              <div className="page-heading">
                <div>
                  <h2>
                    Winner History
                  </h2>

                  <p>
                    View spin activity,
                    winners and issued
                    coupons.
                  </p>
                </div>

                <button
                  className="secondary-button"
                  onClick={loadHistory}
                  disabled={
                    loadingHistory
                  }
                >
                  ↻ Refresh
                </button>
              </div>

              <div className="panel filter-panel">
                <div className="filter-header">
                  <div>
                    <h3>
                      Search & Filters
                    </h3>

                    <p>
                      Find winners by
                      mobile number,
                      coupon code or
                      prize.
                    </p>
                  </div>

                  <button
                    className="clear-button"
                    onClick={
                      clearHistoryFilters
                    }
                  >
                    Clear Filters
                  </button>
                </div>

                <div className="filters-grid">
                  <div className="filter-field search-field">
                    <label>
                      Search
                    </label>

                    <div className="input-with-icon">
                      <span>
                        🔎
                      </span>

                      <input
                        type="text"
                        value={
                          historySearch
                        }
                        onChange={(event) =>
                          setHistorySearch(
                            event.target
                              .value
                          )
                        }
                        placeholder="Mobile number, coupon code or prize..."
                      />
                    </div>
                  </div>

                  <div className="filter-field">
                    <label>
                      Prize
                    </label>

                    <select
                      value={
                        historyPrizeFilter
                      }
                      onChange={(event) =>
                        setHistoryPrizeFilter(
                          event.target
                            .value
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

                  <div className="filter-field">
                    <label>
                      Coupon Status
                    </label>

                    <select
                      value={
                        historyStatusFilter
                      }
                      onChange={(event) =>
                        setHistoryStatusFilter(
                          event.target
                            .value
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

                  <div className="filter-field">
                    <label>
                      Date
                    </label>

                    <select
                      value={
                        historyDateFilter
                      }
                      onChange={(event) =>
                        setHistoryDateFilter(
                          event.target
                            .value
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
                </div>

                <div className="filter-result">
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
              </div>

              {historyError && (
                <div className="panel error-panel">
                  <div className="error-icon">
                    !
                  </div>

                  <div>
                    <h3>
                      Unable to load
                      winner history
                    </h3>

                    <p>
                      {historyError}
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={
                      loadHistory
                    }
                  >
                    Retry
                  </button>
                </div>
              )}

              {!historyError &&
                loadingHistory && (
                  <div className="panel loading-panel">
                    <div className="spinner" />

                    <p>
                      Loading winner
                      history...
                    </p>
                  </div>
                )}

              {!historyError &&
                !loadingHistory &&
                filteredHistory.length ===
                  0 && (
                  <div className="panel empty-panel">
                    <div className="empty-icon">
                      🏆
                    </div>

                    <h3>
                      {history.length ===
                      0
                        ? "No spins yet"
                        : "No matching records"}
                    </h3>

                    <p>
                      {history.length ===
                      0
                        ? "Winner activity will appear here after customers use the wheel."
                        : "Try changing your search or filters."}
                    </p>

                    {history.length >
                      0 && (
                      <button
                        className="secondary-button"
                        onClick={
                          clearHistoryFilters
                        }
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                )}

              {!historyError &&
                !loadingHistory &&
                filteredHistory.length >
                  0 && (
                  <div className="panel">
                    <div className="history-table-wrapper">
                      <table className="data-table history-table">
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
                                  <div className="date-cell">
                                    {formatDateTime(
                                      record.created_at
                                    )}
                                  </div>
                                </td>

                                <td>
                                  <span className="mobile-number">
                                    {
                                      record.mobile
                                    }
                                  </span>
                                </td>

                                <td>
                                  <div className="history-prize">
                                    <span className="history-prize-icon">
                                      🎁
                                    </span>

                                    <strong>
                                      {
                                        record.prize_name
                                      }
                                    </strong>
                                  </div>
                                </td>

                                <td>
                                  <span className="coupon-code">
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

                    <div className="history-footer">
                      <span>
                        Latest 100 spin
                        records are
                        loaded for
                        Winner History.
                      </span>

                      <button
                        className="secondary-button"
                        onClick={
                          loadHistory
                        }
                      >
                        ↻ Refresh
                      </button>
                    </div>
                  </div>
                )}
            </>
          )}

          {activeTab ===
            "statistics" && (
            <>
              <div className="page-heading">
                <div>
                  <h2>
                    Campaign Statistics
                  </h2>

                  <p>
                    Monitor spins,
                    coupons and prize
                    distribution.
                  </p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => {
                    loadStatistics();
                    loadHistory();
                  }}
                  disabled={
                    loadingStatistics
                  }
                >
                  ↻ Refresh
                </button>
              </div>

              {statisticsError && (
                <div className="alert error">
                  <span>!</span>

                  <span>
                    {statisticsError}
                  </span>
                </div>
              )}

              <div className="stats-grid">
                <div className="stat-card large-stat">
                  <div className="stat-icon red">
                    🎯
                  </div>

                  <div>
                    <div className="stat-label">
                      TOTAL SPINS
                    </div>

                    <div className="stat-value">
                      {loadingStatistics
                        ? "..."
                        : statistics.totalSpins}
                    </div>

                    <div className="stat-note">
                      Customers who
                      completed a spin
                    </div>
                  </div>
                </div>

                <div className="stat-card large-stat">
                  <div className="stat-icon">
                    🎟️
                  </div>

                  <div>
                    <div className="stat-label">
                      TOTAL COUPONS
                    </div>

                    <div className="stat-value">
                      {loadingStatistics
                        ? "..."
                        : statistics.totalCoupons}
                    </div>

                    <div className="stat-note">
                      Coupons generated
                    </div>
                  </div>
                </div>

                <div className="stat-card large-stat">
                  <div className="stat-icon green">
                    ✓
                  </div>

                  <div>
                    <div className="stat-label">
                      ISSUED
                    </div>

                    <div className="stat-value">
                      {loadingStatistics
                        ? "..."
                        : statistics.issuedCoupons}
                    </div>

                    <div className="stat-note">
                      {issuedPercentage}% of
                      total coupons
                    </div>
                  </div>
                </div>

                <div className="stat-card large-stat">
                  <div className="stat-icon purple">
                    ✓
                  </div>

                  <div>
                    <div className="stat-label">
                      REDEEMED
                    </div>

                    <div className="stat-value">
                      {loadingStatistics
                        ? "..."
                        : statistics.redeemedCoupons}
                    </div>

                    <div className="stat-note">
                      {redeemedPercentage}%
                      of total
                      coupons
                    </div>
                  </div>
                </div>
              </div>

              <div className="statistics-grid">
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>
                        Prize-wise Winner
                        Distribution
                      </h3>

                      <p>
                        Distribution based
                        on the loaded Winner
                        History records.
                      </p>
                    </div>
                  </div>

                  {prizeDistribution.length ===
                  0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        📊
                      </div>

                      <p>
                        No winner data
                        available yet.
                      </p>
                    </div>
                  ) : (
                    <div className="distribution-list">
                      {prizeDistribution.map(
                        (item) => {
                          const percentage =
                            totalDistributionSpins >
                            0
                              ? (item.count /
                                  totalDistributionSpins) *
                                100
                              : 0;

                          return (
                            <div
                              className="distribution-item"
                              key={
                                item.id
                              }
                            >
                              <div className="distribution-top">
                                <div>
                                  <strong>
                                    {
                                      item.name
                                    }
                                  </strong>

                                  <span>
                                    {
                                      item.count
                                    }{" "}
                                    winner
                                    {item.count !==
                                    1
                                      ? "s"
                                      : ""}
                                  </span>
                                </div>

                                <strong>
                                  {percentage.toFixed(
                                    1
                                  )}
                                  %
                                </strong>
                              </div>

                              <div className="progress-track">
                                <div
                                  className="progress-bar"
                                  style={{
                                    width: `${Math.min(
                                      percentage,
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>
                        Coupon Status
                      </h3>

                      <p>
                        Current coupon
                        redemption
                        breakdown.
                      </p>
                    </div>
                  </div>

                  <div className="coupon-stat-card">
                    <div className="coupon-stat-top">
                      <div className="coupon-stat-icon issued">
                        🎟️
                      </div>

                      <div>
                        <span>
                          Issued
                        </span>

                        <strong>
                          {
                            statistics.issuedCoupons
                          }
                        </strong>
                      </div>

                      <b>
                        {issuedPercentage}%
                      </b>
                    </div>

                    <div className="progress-track">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${issuedPercentage}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="coupon-stat-card">
                    <div className="coupon-stat-top">
                      <div className="coupon-stat-icon redeemed">
                        ✓
                      </div>

                      <div>
                        <span>
                          Redeemed
                        </span>

                        <strong>
                          {
                            statistics.redeemedCoupons
                          }
                        </strong>
                      </div>

                      <b>
                        {
                          redeemedPercentage
                        }
                        %
                      </b>
                    </div>

                    <div className="progress-track">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${redeemedPercentage}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="statistics-summary">
                    <div>
                      <span>
                        Total coupons
                      </span>

                      <strong>
                        {
                          statistics.totalCoupons
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Active prizes
                      </span>

                      <strong>
                        {activePrizes}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Active weight
                      </span>

                      <strong>
                        {
                          activeWinningWeight
                        }
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h3>
                      Recent Activity
                    </h3>

                    <p>
                      Most recent winner
                      activity.
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      selectTab(
                        "history"
                      )
                    }
                  >
                    View Full History
                  </button>
                </div>

                {history.length ===
                0 ? (
                  <div className="empty-state">
                    <p>
                      No recent activity.
                    </p>
                  </div>
                ) : (
                  <div className="recent-list">
                    {history
                      .slice(0, 5)
                      .map(
                        (record) => (
                          <div
                            className="recent-item"
                            key={
                              record.id
                            }
                          >
                            <div className="recent-icon">
                              🏆
                            </div>

                            <div className="recent-content">
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

                            <div className="recent-right">
                              <span className="coupon-code">
                                {
                                  record.coupon_code
                                }
                              </span>

                              <small>
                                {formatDateTime(
                                  record.created_at
                                )}
                              </small>
                            </div>
                          </div>
                        )
                      )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingPrize
                    ? "Edit Prize"
                    : "Add Prize"}
                </h2>

                <p>
                  Configure the prize
                  and its winning
                  probability.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={closeForm}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={savePrize}
            >
              <div className="form-grid">
                <div className="form-group full">
                  <label>
                    Prize Name
                  </label>

                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        name:
                          event.target
                            .value,
                      })
                    }
                    placeholder="e.g. 10% OFF"
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>
                    Description
                  </label>

                  <textarea
                    value={
                      form.description
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        description:
                          event.target
                            .value,
                      })
                    }
                    placeholder="Short description of the prize"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>
                    Weight
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.weight}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        weight:
                          event.target
                            .value,
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
                      form.sort_order
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        sort_order:
                          event.target
                            .value,
                      })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Coupon Prefix
                  </label>

                  <input
                    type="text"
                    value={
                      form.coupon_prefix
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        coupon_prefix:
                          event.target
                            .value
                            .toUpperCase(),
                      })
                    }
                    placeholder="e.g. SG10"
                    maxLength={10}
                    required
                  />

                  <small>
                    Used when generating
                    coupon codes.
                  </small>
                </div>

                <div className="form-group">
                  <label>
                    Status
                  </label>

                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={
                        form.active
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          active:
                            event.target
                              .checked,
                        })
                      }
                    />

                    <span className="switch" />

                    <span>
                      {form.active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeForm
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
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

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .admin-page {
          min-height: 100vh;
          background: #f5f6f8;
          color: #171717;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 255px;
          background: #111315;
          color: #fff;
          display: flex;
          flex-direction: column;
          z-index: 100;
        }

        .sidebar-top {
          padding: 25px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.07);
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-mark {
          width: 43px;
          height: 43px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e31b23;
          color: #fff;
          font-size: 25px;
          font-weight: 900;
        }

        .brand-name {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .brand-subtitle {
          margin-top: 2px;
          color: #a5a5a5;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .mobile-close {
          display: none;
          border: 0;
          background: transparent;
          color: #fff;
          font-size: 28px;
          cursor: pointer;
        }

        .sidebar-label {
          padding: 28px 22px 10px;
          color: #777;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 0 12px;
        }

        .nav-item {
          border: 0;
          background: transparent;
          color: #aaa;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          text-align: left;
          transition:
            background 0.2s,
            color 0.2s;
        }

        .nav-item:hover {
          background: #1b1d20;
          color: #fff;
        }

        .nav-item.active {
          background: #e31b23;
          color: #fff;
        }

        .nav-icon {
          width: 23px;
          text-align: center;
          font-size: 16px;
        }

        .sidebar-bottom {
          margin-top: auto;
          padding: 18px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.07);
        }

        .admin-user {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #292c30;
          color: #fff;
          font-size: 14px;
          font-weight: 800;
        }

        .user-details {
          min-width: 0;
        }

        .user-label {
          color: #777;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .user-email {
          margin-top: 3px;
          color: #ddd;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }

        .logout-button {
          width: 100%;
          border: 1px solid #292c30;
          border-radius: 7px;
          background: transparent;
          color: #aaa;
          padding: 10px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .logout-button:hover {
          background: #1b1d20;
          color: #fff;
        }

        .main-area {
          min-height: 100vh;
          margin-left: 255px;
        }

        .admin-header {
          min-height: 78px;
          background: #fff;
          border-bottom: 1px solid #e8e8e8;
          padding: 15px 30px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .header-left h1 {
          margin: 0;
          font-size: 21px;
          font-weight: 800;
        }

        .header-left p {
          margin: 4px 0 0;
          color: #888;
          font-size: 12px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .header-email {
          color: #666;
          font-size: 11px;
        }

        .header-status {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #555;
          font-size: 11px;
          font-weight: 700;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #21a366;
        }

        .mobile-menu {
          display: none;
          border: 0;
          background: transparent;
          font-size: 24px;
          cursor: pointer;
        }

        .content {
          padding: 30px;
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .page-heading h2 {
          margin: 0;
          font-size: 20px;
        }

        .page-heading p {
          margin: 5px 0 0;
          color: #888;
          font-size: 12px;
        }

        .alert {
          padding: 12px 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          font-weight: 600;
        }

        .alert.success {
          background: #edf9f1;
          border: 1px solid #cdebd6;
          color: #20753c;
        }

        .alert.error {
          background: #fff0f0;
          border: 1px solid #f1cccc;
          color: #b4232b;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 16px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 10px;
          padding: 19px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 2px 7px
            rgba(0, 0, 0, 0.025);
        }

        .stat-icon {
          width: 43px;
          height: 43px;
          border-radius: 10px;
          background: #fff1f1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
          flex-shrink: 0;
        }

        .stat-icon.green {
          background: #edf9f1;
        }

        .stat-icon.gray {
          background: #f1f2f3;
        }

        .stat-icon.red {
          background: #fff1f1;
        }

        .stat-icon.purple {
          background: #f3efff;
        }

        .stat-label {
          color: #888;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.9px;
        }

        .stat-value {
          margin-top: 3px;
          font-size: 24px;
          font-weight: 850;
        }

        .stat-note {
          margin-top: 3px;
          color: #aaa;
          font-size: 10px;
        }

        .two-column {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .panel {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 10px;
          box-shadow: 0 2px 7px
            rgba(0, 0, 0, 0.025);
          overflow: hidden;
        }

        .panel-header {
          padding: 19px 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 14px;
        }

        .panel-header p {
          margin: 4px 0 0;
          color: #999;
          font-size: 11px;
        }

        .probability-list {
          padding: 5px 20px;
        }

        .probability-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 14px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .probability-row:last-child {
          border-bottom: 0;
        }

        .probability-main {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .prize-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #c7c7c7;
        }

        .prize-dot.active {
          background: #e31b23;
        }

        .probability-name {
          font-size: 12px;
          font-weight: 700;
        }

        .probability-weight {
          margin-top: 2px;
          color: #999;
          font-size: 10px;
        }

        .probability-value {
          font-size: 12px;
          font-weight: 800;
        }

        .summary-list {
          padding: 8px 20px 15px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
          color: #777;
          font-size: 12px;
        }

        .summary-row:last-child {
          border-bottom: 0;
        }

        .summary-row strong {
          color: #171717;
          font-size: 13px;
        }

        .quick-actions {
          margin-bottom: 20px;
        }

        .action-grid {
          display: grid;
          grid-template-columns: repeat(
            3,
            1fr
          );
          gap: 12px;
          padding: 18px;
        }

        .action-card {
          border: 1px solid #e8e8e8;
          background: #fafafa;
          border-radius: 9px;
          padding: 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          text-align: left;
          cursor: pointer;
        }

        .action-card:hover {
          border-color: #e31b23;
          background: #fff;
        }

        .action-card > span {
          font-size: 21px;
        }

        .action-card strong {
          display: block;
          font-size: 12px;
        }

        .action-card small {
          display: block;
          margin-top: 4px;
          color: #999;
          line-height: 1.4;
          font-size: 10px;
        }

        .primary-button,
        .secondary-button,
        .clear-button {
          border-radius: 7px;
          padding: 10px 15px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .primary-button {
          border: 1px solid #e31b23;
          background: #e31b23;
          color: #fff;
        }

        .primary-button:hover {
          background: #c9151d;
        }

        .primary-button:disabled,
        .secondary-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .secondary-button {
          border: 1px solid #ddd;
          background: #fff;
          color: #444;
        }

        .secondary-button:hover {
          background: #f7f7f7;
        }

        .clear-button {
          border: 0;
          background: transparent;
          color: #e31b23;
          padding: 5px;
        }

        .loading-panel,
        .empty-panel {
          min-height: 250px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 30px;
        }

        .loading-panel p {
          color: #888;
          font-size: 12px;
        }

        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #eee;
          border-top-color: #e31b23;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-icon {
          font-size: 35px;
          margin-bottom: 8px;
        }

        .empty-panel h3 {
          margin: 0;
          font-size: 15px;
        }

        .empty-panel p {
          margin: 6px 0 18px;
          color: #999;
          font-size: 11px;
        }

        .empty-state {
          padding: 35px 20px;
          text-align: center;
          color: #999;
          font-size: 12px;
        }

        .empty-state.small {
          padding: 25px 0;
        }

        .table-wrapper,
        .history-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        .data-table th {
          background: #fafafa;
          color: #888;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          text-align: left;
          padding: 13px 16px;
          border-bottom: 1px solid #e8e8e8;
          white-space: nowrap;
        }

        .data-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #f0f0f0;
          font-size: 11px;
          vertical-align: middle;
        }

        .data-table tbody tr:hover {
          background: #fcfcfc;
        }

        .table-prize strong {
          display: block;
          font-size: 12px;
        }

        .table-prize small {
          display: block;
          max-width: 250px;
          margin-top: 3px;
          color: #999;
          line-height: 1.3;
        }

        .order-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 27px;
          height: 27px;
          border-radius: 7px;
          background: #f1f2f3;
          color: #555;
          font-weight: 800;
        }

        .coupon-prefix,
        .coupon-code {
          display: inline-block;
          border-radius: 5px;
          background: #f4f4f4;
          padding: 6px 8px;
          color: #333;
          font-family: monospace;
          font-size: 10px;
          font-weight: 700;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 20px;
          padding: 6px 9px;
          font-size: 9px;
          font-weight: 800;
        }

        .status-badge span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .status-badge.active {
          background: #edf9f1;
          color: #23753e;
        }

        .status-badge.active span {
          background: #2aa054;
        }

        .status-badge.inactive {
          background: #f2f2f2;
          color: #777;
        }

        .status-badge.inactive span {
          background: #999;
        }

        .table-actions {
          display: flex;
          gap: 5px;
        }

        .small-button {
          border-radius: 5px;
          border: 1px solid #ddd;
          background: #fff;
          padding: 6px 8px;
          cursor: pointer;
          font-size: 9px;
          font-weight: 800;
        }

        .small-button.edit {
          color: #444;
        }

        .small-button.warning {
          color: #a26c00;
        }

        .small-button.success {
          color: #23753e;
        }

        .small-button.danger {
          color: #c51f28;
        }

        .small-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .filter-panel {
          padding: 0;
          margin-bottom: 18px;
        }

        .filter-header {
          padding: 18px 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .filter-header h3 {
          margin: 0;
          font-size: 13px;
        }

        .filter-header p {
          margin: 4px 0 0;
          color: #999;
          font-size: 10px;
        }

        .filters-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 12px;
          padding: 17px 20px 10px;
        }

        .filter-field label,
        .form-group label {
          display: block;
          margin-bottom: 6px;
          color: #555;
          font-size: 10px;
          font-weight: 800;
        }

        .filter-field input,
        .filter-field select,
        .form-group input,
        .form-group textarea {
          width: 100%;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: #fff;
          padding: 10px 11px;
          outline: none;
          font: inherit;
          font-size: 11px;
          color: #222;
        }

        .filter-field input:focus,
        .filter-field select:focus,
        .form-group input:focus,
        .form-group textarea:focus {
          border-color: #e31b23;
          box-shadow: 0 0 0 2px
            rgba(227, 27, 35, 0.08);
        }

        .input-with-icon {
          position: relative;
        }

        .input-with-icon > span {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
        }

        .input-with-icon input {
          padding-left: 31px;
        }

        .filter-result {
          padding: 9px 20px 16px;
          color: #999;
          font-size: 10px;
        }

        .filter-result strong {
          color: #444;
        }

        .history-table {
          min-width: 900px;
        }

        .date-cell {
          color: #666;
          white-space: nowrap;
        }

        .mobile-number {
          color: #222;
          font-family: monospace;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .history-prize {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .history-prize-icon {
          width: 27px;
          height: 27px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #fff2f2;
        }

        .history-status {
          display: inline-block;
          padding: 6px 9px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 800;
          text-transform: capitalize;
        }

        .history-status.issued {
          background: #edf9f1;
          color: #23753e;
        }

        .history-status.redeemed {
          background: #f3efff;
          color: #6941c6;
        }

        .history-status.other {
          background: #f2f2f2;
          color: #777;
        }

        .history-footer {
          padding: 12px 16px;
          border-top: 1px solid #eee;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          color: #999;
          font-size: 10px;
        }

        .error-panel {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 18px;
        }

        .error-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #fff0f0;
          color: #c51f28;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          flex-shrink: 0;
        }

        .error-panel h3 {
          margin: 0;
          font-size: 13px;
        }

        .error-panel p {
          margin: 4px 0 0;
          color: #999;
          font-size: 10px;
        }

        .error-panel .secondary-button {
          margin-left: auto;
        }

        .statistics-grid {
          display: grid;
          grid-template-columns: 1.3fr 0.7fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .distribution-list {
          padding: 8px 20px 18px;
        }

        .distribution-item {
          padding: 14px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .distribution-item:last-child {
          border-bottom: 0;
        }

        .distribution-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 8px;
        }

        .distribution-top div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .distribution-top strong {
          font-size: 11px;
        }

        .distribution-top span {
          color: #999;
          font-size: 9px;
        }

        .progress-track {
          height: 7px;
          background: #eee;
          border-radius: 20px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: #e31b23;
          border-radius: inherit;
          transition: width 0.3s;
        }

        .coupon-stat-card {
          margin: 15px 20px;
          padding: 13px;
          border: 1px solid #eee;
          border-radius: 8px;
        }

        .coupon-stat-top {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .coupon-stat-icon {
          width: 33px;
          height: 33px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #edf9f1;
        }

        .coupon-stat-icon.redeemed {
          background: #f3efff;
        }

        .coupon-stat-top div:nth-child(2) {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .coupon-stat-top span {
          color: #999;
          font-size: 9px;
        }

        .coupon-stat-top strong {
          font-size: 15px;
        }

        .coupon-stat-top > b {
          font-size: 11px;
        }

        .statistics-summary {
          margin: 8px 20px 20px;
          border-top: 1px solid #eee;
        }

        .statistics-summary > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
          color: #777;
          font-size: 10px;
        }

        .statistics-summary strong {
          color: #222;
        }

        .recent-list {
          padding: 4px 20px 10px;
        }

        .recent-item {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .recent-item:last-child {
          border-bottom: 0;
        }

        .recent-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #fff2f2;
        }

        .recent-content {
          min-width: 0;
          flex: 1;
        }

        .recent-content strong {
          display: block;
          font-size: 11px;
        }

        .recent-content span {
          display: block;
          margin-top: 3px;
          color: #888;
          font-family: monospace;
          font-size: 9px;
        }

        .recent-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .recent-right small {
          color: #999;
          font-size: 8px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 300;
          background: rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: min(620px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 20px 70px
            rgba(0, 0, 0, 0.25);
        }

        .modal-header {
          padding: 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 17px;
        }

        .modal-header p {
          margin: 4px 0 0;
          color: #999;
          font-size: 10px;
        }

        .modal-close {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 6px;
          background: #f3f3f3;
          color: #555;
          font-size: 21px;
          cursor: pointer;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          padding: 20px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .form-group small {
          display: block;
          margin-top: 4px;
          color: #999;
          font-size: 9px;
        }

        .switch-row {
          height: 39px;
          display: flex !important;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .switch-row input {
          display: none;
        }

        .switch {
          width: 35px;
          height: 20px;
          background: #ccc;
          border-radius: 20px;
          position: relative;
        }

        .switch::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          transition: 0.2s;
        }

        .switch-row input:checked
          + .switch {
          background: #e31b23;
        }

        .switch-row input:checked
          + .switch::after {
          transform: translateX(15px);
        }

        .modal-footer {
          padding: 15px 20px 20px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .sidebar-overlay {
          display: none;
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

          .two-column,
          .statistics-grid {
            grid-template-columns: 1fr;
          }

          .filters-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 800px) {
          .sidebar {
            transform: translateX(
              -100%
            );
            transition: transform 0.25s
              ease;
          }

          .sidebar.open {
            transform: translateX(0);
          }

          .mobile-close {
            display: block;
          }

          .sidebar-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 90;
            border: 0;
            background: rgba(0, 0, 0, 0.45);
          }

          .main-area {
            margin-left: 0;
          }

          .mobile-menu {
            display: block;
          }

          .header-right {
            display: none;
          }

          .admin-header {
            padding: 14px 18px;
          }

          .content {
            padding: 20px 15px;
          }

          .action-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .filters-grid {
            grid-template-columns: 1fr;
          }

          .page-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .page-heading
            .primary-button,
          .page-heading
            .secondary-button {
            width: 100%;
          }

          .filter-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .clear-button {
            padding: 0;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full {
            grid-column: auto;
          }

          .history-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .history-footer
            .secondary-button {
            width: 100%;
          }

          .error-panel {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .error-panel
            .secondary-button {
            width: 100%;
            margin-left: 0;
          }

          .recent-item {
            align-items: flex-start;
          }

          .recent-right {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}
