"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type ActiveTab = "overview" | "prizes" | "history" | "statistics";

type Prize = {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  active: boolean;
  sort_order: number;
  coupon_prefix: string;
  created_at: string;
  updated_at: string;
};

type PrizeForm = {
  name: string;
  description: string;
  weight: string;
  active: boolean;
  sort_order: string;
  coupon_prefix: string;
};

type CouponInfo = {
  id: string;
  code: string;
  status: string;
};

type SpinRow = {
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
  prize_name: string;
  coupon_id: string;
  coupon_code: string;
  coupon_status: string;
  created_at: string;
};

const emptyPrizeForm: PrizeForm = {
  name: "",
  description: "",
  weight: "1",
  active: true,
  sort_order: "0",
  coupon_prefix: "SG",
};

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [history, setHistory] = useState<SpinHistory[]>([]);

  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [prizeForm, setPrizeForm] = useState<PrizeForm>(emptyPrizeForm);

  // Stage 3C filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyPrizeFilter, setHistoryPrizeFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyDateFilter, setHistoryDateFilter] = useState("all");

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const { data: adminUser, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !adminUser) {
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      await Promise.all([loadPrizes(), loadHistory()]);
    } catch (error) {
      console.error("Admin check error:", error);
      router.replace("/admin/login");
    } finally {
      setLoading(false);
    }
  }

  async function loadPrizes() {
    const { data, error } = await supabase
      .from("prizes")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading prizes:", error);
      return;
    }

    setPrizes(data || []);
  }

  async function loadHistory() {
    const { data: spinsData, error: spinsError } = await supabase
      .from("spins")
      .select("id, mobile, prize_id, coupon_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (spinsError) {
      console.error("Error loading spins:", spinsError);
      return;
    }

    const spins = (spinsData || []) as SpinRow[];

    if (spins.length === 0) {
      setHistory([]);
      return;
    }

    const prizeIds = [...new Set(spins.map((spin) => spin.prize_id))];
    const couponIds = [...new Set(spins.map((spin) => spin.coupon_id))];

    const [{ data: prizesData, error: prizesError }, { data: couponsData, error: couponsError }] =
      await Promise.all([
        supabase
          .from("prizes")
          .select("id, name")
          .in("id", prizeIds),

        supabase
          .from("coupons")
          .select("id, code, status")
          .in("id", couponIds),
      ]);

    if (prizesError) {
      console.error("Error loading history prizes:", prizesError);
    }

    if (couponsError) {
      console.error("Error loading history coupons:", couponsError);
    }

    const prizeMap = new Map<string, string>();
    (prizesData || []).forEach((prize) => {
      prizeMap.set(prize.id, prize.name);
    });

    const couponMap = new Map<string, CouponInfo>();
    (couponsData || []).forEach((coupon) => {
      couponMap.set(coupon.id, coupon);
    });

    const joinedHistory: SpinHistory[] = spins.map((spin) => {
      const coupon = couponMap.get(spin.coupon_id);

      return {
        id: spin.id,
        mobile: spin.mobile,
        prize_id: spin.prize_id,
        prize_name: prizeMap.get(spin.prize_id) || "Prize unavailable",
        coupon_id: spin.coupon_id,
        coupon_code: coupon?.code || "Coupon unavailable",
        coupon_status: coupon?.status || "unknown",
        created_at: spin.created_at,
      };
    });

    setHistory(joinedHistory);
  }

  function openAddPrizeModal() {
    setEditingPrize(null);
    setPrizeForm(emptyPrizeForm);
    setShowPrizeModal(true);
  }

  function openEditPrizeModal(prize: Prize) {
    setEditingPrize(prize);

    setPrizeForm({
      name: prize.name,
      description: prize.description || "",
      weight: String(prize.weight),
      active: prize.active,
      sort_order: String(prize.sort_order),
      coupon_prefix: prize.coupon_prefix,
    });

    setShowPrizeModal(true);
  }

  function closePrizeModal() {
    if (saving) return;

    setShowPrizeModal(false);
    setEditingPrize(null);
    setPrizeForm(emptyPrizeForm);
  }

  async function savePrize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prizeForm.name.trim()) {
      alert("Please enter a prize name.");
      return;
    }

    const weight = Number(prizeForm.weight);
    const sortOrder = Number(prizeForm.sort_order);

    if (!Number.isFinite(weight) || weight < 0) {
      alert("Please enter a valid weight.");
      return;
    }

    if (!Number.isFinite(sortOrder)) {
      alert("Please enter a valid sort order.");
      return;
    }

    if (!prizeForm.coupon_prefix.trim()) {
      alert("Please enter a coupon prefix.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: prizeForm.name.trim(),
        description: prizeForm.description.trim() || null,
        weight,
        active: prizeForm.active,
        sort_order: sortOrder,
        coupon_prefix: prizeForm.coupon_prefix.trim().toUpperCase(),
        updated_at: new Date().toISOString(),
      };

      if (editingPrize) {
        const { error } = await supabase
          .from("prizes")
          .update(payload)
          .eq("id", editingPrize.id);

        if (error) {
          console.error("Update prize error:", error);
          alert(error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("prizes").insert(payload);

        if (error) {
          console.error("Insert prize error:", error);
          alert(error.message);
          return;
        }
      }

      await loadPrizes();
      closePrizeModal();
    } finally {
      setSaving(false);
    }
  }

  async function togglePrize(prize: Prize) {
    const { error } = await supabase
      .from("prizes")
      .update({
        active: !prize.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prize.id);

    if (error) {
      console.error("Toggle prize error:", error);
      alert(error.message);
      return;
    }

    await loadPrizes();
  }

  async function deletePrize(prize: Prize) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${prize.name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("prizes")
      .delete()
      .eq("id", prize.id);

    if (error) {
      console.error("Delete prize error:", error);
      alert(
        "Unable to delete this prize. It may already be linked to spin history."
      );
      return;
    }

    await loadPrizes();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  function selectTab(tab: ActiveTab) {
    setActiveTab(tab);
  }

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

    if (normalized === "issued" || normalized === "active") {
      return "history-status issued";
    }

    if (normalized === "redeemed") {
      return "history-status redeemed";
    }

    return "history-status other";
  }

  function isWithinDateFilter(value: string, filter: string) {
    if (filter === "all") {
      return true;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const now = new Date();

    if (filter === "today") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      return date >= startOfToday && date <= now;
    }

    const startDate = new Date();

    if (filter === "7days") {
      startDate.setDate(startDate.getDate() - 7);
    }

    if (filter === "30days") {
      startDate.setDate(startDate.getDate() - 30);
    }

    return date >= startDate && date <= now;
  }

  const totalPrizes = prizes.length;
  const activePrizes = prizes.filter((prize) => prize.active).length;
  const inactivePrizes = prizes.filter((prize) => !prize.active).length;

  const totalWinningWeight = prizes.reduce(
    (sum, prize) => sum + Number(prize.weight || 0),
    0
  );

  const activeWinningWeight = prizes
    .filter((prize) => prize.active)
    .reduce((sum, prize) => sum + Number(prize.weight || 0), 0);

  const totalSpins = history.length;

  // Stage 3C - Filtered history
  const filteredHistory = history.filter((record) => {
    const search = historySearch.trim().toLowerCase();

    const matchesSearch =
      !search ||
      record.mobile.toLowerCase().includes(search) ||
      record.coupon_code.toLowerCase().includes(search) ||
      record.prize_name.toLowerCase().includes(search);

    const matchesPrize =
      historyPrizeFilter === "all" ||
      record.prize_id === historyPrizeFilter;

    const matchesStatus =
      historyStatusFilter === "all" ||
      record.coupon_status.toLowerCase() ===
        historyStatusFilter.toLowerCase();

    const matchesDate = isWithinDateFilter(
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

  const historyPrizeOptions = Array.from(
    new Map(
      history.map((record) => [
        record.prize_id,
        {
          id: record.prize_id,
          name: record.prize_name,
        },
      ])
    ).values()
  );

  const historyStatusOptions = Array.from(
    new Set(history.map((record) => record.coupon_status))
  );

  const hasActiveHistoryFilters =
    historySearch.trim() !== "" ||
    historyPrizeFilter !== "all" ||
    historyStatusFilter !== "all" ||
    historyDateFilter !== "all";

  function clearHistoryFilters() {
    setHistorySearch("");
    setHistoryPrizeFilter("all");
    setHistoryStatusFilter("all");
    setHistoryDateFilter("all");
  }

  // Stage 3C - Statistics
  const issuedCount = history.filter(
    (record) => record.coupon_status.toLowerCase() === "issued"
  ).length;

  const redeemedCount = history.filter(
    (record) => record.coupon_status.toLowerCase() === "redeemed"
  ).length;

  const otherCouponCount =
    history.length - issuedCount - redeemedCount;

  const redemptionRate =
    history.length > 0
      ? (redeemedCount / history.length) * 100
      : 0;

  const prizeDistribution = Array.from(
    history.reduce((map, record) => {
      const current = map.get(record.prize_name) || 0;
      map.set(record.prize_name, current + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([name, count]) => ({
      name,
      count,
      percentage:
        history.length > 0 ? (count / history.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const couponStatusDistribution = Array.from(
    history.reduce((map, record) => {
      const status = record.coupon_status || "unknown";
      const current = map.get(status) || 0;
      map.set(status, current + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  const recentActivity = history.slice(0, 5);

  if (loading) {
    return (
      <>
        <style>{adminStyles}</style>

        <div className="admin-loading">
          <div className="loading-spinner" />
          <p>Loading admin panel...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{adminStyles}</style>

      <div className="admin-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-logo">S</div>

            <div>
              <div className="brand-title">SINGHAGIRI</div>
              <div className="brand-subtitle">SPIN & WIN</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`nav-item ${
                activeTab === "overview" ? "active" : ""
              }`}
              onClick={() => selectTab("overview")}
            >
              <span className="nav-icon">⌂</span>
              <span>Overview</span>
            </button>

            <button
              className={`nav-item ${
                activeTab === "prizes" ? "active" : ""
              }`}
              onClick={() => selectTab("prizes")}
            >
              <span className="nav-icon">◉</span>
              <span>Prize Management</span>
            </button>

            <button
              className={`nav-item ${
                activeTab === "history" ? "active" : ""
              }`}
              onClick={() => selectTab("history")}
            >
              <span className="nav-icon">◷</span>
              <span>Winner History</span>
            </button>

            <button
              className={`nav-item ${
                activeTab === "statistics" ? "active" : ""
              }`}
              onClick={() => selectTab("statistics")}
            >
              <span className="nav-icon">▥</span>
              <span>Statistics</span>
            </button>
          </nav>

          <div className="sidebar-bottom">
            <button className="logout-button" onClick={logout}>
              <span className="nav-icon">↪</span>
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-content">

            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">ADMINISTRATION</div>
                    <h1>Overview</h1>
                    <p>
                      Manage your Spin & Win campaign and monitor activity.
                    </p>
                  </div>
                </div>

                <div className="overview-grid">
                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">TOTAL PRIZES</span>
                      <span className="overview-icon">◉</span>
                    </div>

                    <div className="overview-value">{totalPrizes}</div>

                    <div className="overview-meta">
                      {activePrizes} active · {inactivePrizes} inactive
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        ACTIVE PRIZES
                      </span>
                      <span className="overview-icon">✓</span>
                    </div>

                    <div className="overview-value">
                      {activePrizes}
                    </div>

                    <div className="overview-meta">
                      Currently available on wheel
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        TOTAL SPINS
                      </span>
                      <span className="overview-icon">↻</span>
                    </div>

                    <div className="overview-value">
                      {totalSpins}
                    </div>

                    <div className="overview-meta">
                      Latest 100 records loaded
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        ACTIVE WEIGHT
                      </span>
                      <span className="overview-icon">%</span>
                    </div>

                    <div className="overview-value">
                      {activeWinningWeight}
                    </div>

                    <div className="overview-meta">
                      Total active prize weight
                    </div>
                  </div>
                </div>

                <div className="section-heading">
                  <div>
                    <div className="eyebrow">CAMPAIGN</div>
                    <h2>Campaign Summary</h2>
                  </div>
                </div>

                <div className="table-card campaign-card">
                  <div className="campaign-row">
                    <div>
                      <span className="campaign-label">
                        Campaign Name
                      </span>
                      <strong>Singhagiri Spin & Win</strong>
                    </div>

                    <div>
                      <span className="campaign-label">
                        Active Prizes
                      </span>
                      <strong>{activePrizes}</strong>
                    </div>

                    <div>
                      <span className="campaign-label">
                        Total Weight
                      </span>
                      <strong>{activeWinningWeight}</strong>
                    </div>

                    <div>
                      <span className="campaign-label">
                        Spins Recorded
                      </span>
                      <strong>{totalSpins}</strong>
                    </div>
                  </div>
                </div>

                <div className="section-heading">
                  <div>
                    <div className="eyebrow">PROBABILITY</div>
                    <h2>Prize Weight Distribution</h2>
                  </div>
                </div>

                <div className="table-card">
                  {prizes.length === 0 ? (
                    <div className="empty-state">
                      No prizes have been added yet.
                    </div>
                  ) : (
                    <div className="weight-list">
                      {prizes.map((prize) => {
                        const percentage =
                          prize.active && activeWinningWeight > 0
                            ? (Number(prize.weight) /
                                activeWinningWeight) *
                              100
                            : 0;

                        return (
                          <div className="weight-row" key={prize.id}>
                            <div className="weight-name">
                              <span
                                className={`status-dot ${
                                  prize.active
                                    ? "active-dot"
                                    : "inactive-dot"
                                }`}
                              />
                              <span>{prize.name}</span>
                            </div>

                            <div className="weight-bar-wrap">
                              <div
                                className="weight-bar"
                                style={{
                                  width: `${Math.min(
                                    percentage,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>

                            <div className="weight-value">
                              {prize.active
                                ? `${percentage.toFixed(1)}%`
                                : "Inactive"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="quick-actions">
                  <button
                    className="quick-action"
                    onClick={() => selectTab("prizes")}
                  >
                    <span className="quick-icon">+</span>
                    <span>
                      <strong>Manage Prizes</strong>
                      <small>
                        Add, edit or activate prizes
                      </small>
                    </span>
                  </button>

                  <button
                    className="quick-action"
                    onClick={() => selectTab("history")}
                  >
                    <span className="quick-icon">◷</span>
                    <span>
                      <strong>View Winner History</strong>
                      <small>
                        Review recent customer spins
                      </small>
                    </span>
                  </button>
                </div>
              </>
            )}

            {/* PRIZE MANAGEMENT */}
            {activeTab === "prizes" && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">ADMINISTRATION</div>
                    <h1>Prize Management</h1>
                    <p>
                      Configure the prizes available on the Spin & Win
                      wheel.
                    </p>
                  </div>

                  <button
                    className="primary-button"
                    onClick={openAddPrizeModal}
                  >
                    <span>+</span>
                    Add Prize
                  </button>
                </div>

                <div className="overview-grid">
                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        TOTAL PRIZES
                      </span>
                      <span className="overview-icon">◉</span>
                    </div>

                    <div className="overview-value">
                      {totalPrizes}
                    </div>

                    <div className="overview-meta">
                      All configured prizes
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        ACTIVE
                      </span>
                      <span className="overview-icon">✓</span>
                    </div>

                    <div className="overview-value">
                      {activePrizes}
                    </div>

                    <div className="overview-meta">
                      Available on wheel
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        INACTIVE
                      </span>
                      <span className="overview-icon">−</span>
                    </div>

                    <div className="overview-value">
                      {inactivePrizes}
                    </div>

                    <div className="overview-meta">
                      Hidden from wheel
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        ACTIVE WEIGHT
                      </span>
                      <span className="overview-icon">%</span>
                    </div>

                    <div className="overview-value">
                      {activeWinningWeight}
                    </div>

                    <div className="overview-meta">
                      Total active weight
                    </div>
                  </div>
                </div>

                <div className="section-heading">
                  <div>
                    <div className="eyebrow">CONFIGURATION</div>
                    <h2>Prize List</h2>
                  </div>
                </div>

                <div className="table-card">
                  {prizes.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">◉</div>
                      <h3>No prizes configured</h3>
                      <p>
                        Add your first prize to start configuring the
                        wheel.
                      </p>

                      <button
                        className="primary-button"
                        onClick={openAddPrizeModal}
                      >
                        Add First Prize
                      </button>
                    </div>
                  ) : (
                    <div className="prize-table-wrap">
                      <table className="prize-table">
                        <thead>
                          <tr>
                            <th>PRIZE</th>
                            <th>WEIGHT</th>
                            <th>PROBABILITY</th>
                            <th>COUPON PREFIX</th>
                            <th>STATUS</th>
                            <th>ACTIONS</th>
                          </tr>
                        </thead>

                        <tbody>
                          {prizes.map((prize) => {
                            const probability =
                              prize.active &&
                              activeWinningWeight > 0
                                ? (Number(prize.weight) /
                                    activeWinningWeight) *
                                  100
                                : 0;

                            return (
                              <tr key={prize.id}>
                                <td>
                                  <div className="prize-name-cell">
                                    <strong>{prize.name}</strong>

                                    {prize.description && (
                                      <small>
                                        {prize.description}
                                      </small>
                                    )}
                                  </div>
                                </td>

                                <td>
                                  <strong>{prize.weight}</strong>
                                </td>

                                <td>
                                  {prize.active
                                    ? `${probability.toFixed(1)}%`
                                    : "—"}
                                </td>

                                <td>
                                  <span className="coupon-prefix">
                                    {prize.coupon_prefix}
                                  </span>
                                </td>

                                <td>
                                  <span
                                    className={`prize-status ${
                                      prize.active
                                        ? "status-active"
                                        : "status-inactive"
                                    }`}
                                  >
                                    {prize.active
                                      ? "Active"
                                      : "Inactive"}
                                  </span>
                                </td>

                                <td>
                                  <div className="table-actions">
                                    <button
                                      className="action-button edit"
                                      onClick={() =>
                                        openEditPrizeModal(prize)
                                      }
                                    >
                                      Edit
                                    </button>

                                    <button
                                      className="action-button toggle"
                                      onClick={() =>
                                        togglePrize(prize)
                                      }
                                    >
                                      {prize.active
                                        ? "Deactivate"
                                        : "Activate"}
                                    </button>

                                    <button
                                      className="action-button delete"
                                      onClick={() =>
                                        deletePrize(prize)
                                      }
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="weight-info">
                  <div className="weight-info-icon">i</div>
                  <div>
                    <strong>How prize weights work</strong>
                    <p>
                      The wheel uses the configured weight of each
                      active prize to determine its probability. A
                      prize with weight 20 is twice as likely to be
                      selected as a prize with weight 10.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* WINNER HISTORY */}
            {activeTab === "history" && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">ACTIVITY</div>
                    <h1>Winner History</h1>
                    <p>
                      Review recent Spin & Win customer activity.
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={loadHistory}
                  >
                    ↻ Refresh
                  </button>
                </div>

                <div className="overview-grid history-summary-grid">
                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        RECENT SPINS
                      </span>
                      <span className="overview-icon">↻</span>
                    </div>

                    <div className="overview-value">
                      {filteredHistory.length}
                    </div>

                    <div className="overview-meta">
                      {hasActiveHistoryFilters
                        ? `Showing ${filteredHistory.length} of ${history.length}`
                        : "Latest 100 records"}
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        ISSUED
                      </span>
                      <span className="overview-icon">✓</span>
                    </div>

                    <div className="overview-value">
                      {issuedCount}
                    </div>

                    <div className="overview-meta">
                      Coupons not yet redeemed
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        REDEEMED
                      </span>
                      <span className="overview-icon">✓</span>
                    </div>

                    <div className="overview-value">
                      {redeemedCount}
                    </div>

                    <div className="overview-meta">
                      Successfully redeemed
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        REDEMPTION RATE
                      </span>
                      <span className="overview-icon">%</span>
                    </div>

                    <div className="overview-value">
                      {redemptionRate.toFixed(1)}%
                    </div>

                    <div className="overview-meta">
                      Based on loaded spin records
                    </div>
                  </div>
                </div>

                {/* Stage 3C Filters */}
                <div className="history-filter-card">
                  <div className="history-filter-heading">
                    <div>
                      <div className="eyebrow">FILTERS</div>
                      <h2>Search Winner History</h2>
                    </div>

                    {hasActiveHistoryFilters && (
                      <button
                        className="clear-filter-button"
                        onClick={clearHistoryFilters}
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>

                  <div className="history-filters">
                    <div className="history-filter search-filter">
                      <label>SEARCH</label>
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(event) =>
                          setHistorySearch(event.target.value)
                        }
                        placeholder="Mobile, coupon or prize"
                      />
                    </div>

                    <div className="history-filter">
                      <label>PRIZE</label>
                      <select
                        value={historyPrizeFilter}
                        onChange={(event) =>
                          setHistoryPrizeFilter(event.target.value)
                        }
                      >
                        <option value="all">All Prizes</option>

                        {historyPrizeOptions.map((prize) => (
                          <option
                            key={prize.id}
                            value={prize.id}
                          >
                            {prize.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="history-filter">
                      <label>COUPON STATUS</label>
                      <select
                        value={historyStatusFilter}
                        onChange={(event) =>
                          setHistoryStatusFilter(event.target.value)
                        }
                      >
                        <option value="all">
                          All Statuses
                        </option>

                        {historyStatusOptions.map((status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {status.charAt(0).toUpperCase() +
                              status.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="history-filter">
                      <label>DATE</label>
                      <select
                        value={historyDateFilter}
                        onChange={(event) =>
                          setHistoryDateFilter(event.target.value)
                        }
                      >
                        <option value="all">All Dates</option>
                        <option value="today">Today</option>
                        <option value="7days">
                          Last 7 Days
                        </option>
                        <option value="30days">
                          Last 30 Days
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="history-table-card">
                  <div className="history-table-header">
                    <div>
                      <div className="eyebrow">WINNERS</div>
                      <h2>
                        {hasActiveHistoryFilters
                          ? "Filtered Results"
                          : "Recent Spins"}
                      </h2>
                    </div>

                    <div className="history-count">
                      {filteredHistory.length} record
                      {filteredHistory.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {filteredHistory.length === 0 ? (
                    <div className="history-empty">
                      <div className="empty-icon">◷</div>

                      <h3>
                        {hasActiveHistoryFilters
                          ? "No matching records"
                          : "No spin history yet"}
                      </h3>

                      <p>
                        {hasActiveHistoryFilters
                          ? "Try changing your search or filters."
                          : "Spin activity will appear here once customers start using the wheel."}
                      </p>

                      {hasActiveHistoryFilters && (
                        <button
                          className="secondary-button"
                          onClick={clearHistoryFilters}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="history-table-wrap">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>DATE & TIME</th>
                            <th>MOBILE</th>
                            <th>PRIZE</th>
                            <th>COUPON</th>
                            <th>STATUS</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredHistory.map((record) => (
                            <tr key={record.id}>
                              <td>
                                {formatDateTime(record.created_at)}
                              </td>

                              <td>
                                <span className="mobile-number">
                                  {record.mobile}
                                </span>
                              </td>

                              <td>
                                <strong>
                                  {record.prize_name}
                                </strong>
                              </td>

                              <td>
                                <span className="history-coupon">
                                  {record.coupon_code}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={getStatusClass(
                                    record.coupon_status
                                  )}
                                >
                                  {record.coupon_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="history-note">
                  <div className="weight-info-icon">i</div>
                  <p>
                    Customer mobile numbers are displayed in full for
                    administrator review. History is currently loaded
                    from the latest 100 spin records.
                  </p>
                </div>
              </>
            )}

            {/* STATISTICS */}
            {activeTab === "statistics" && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">ANALYTICS</div>
                    <h1>Statistics</h1>
                    <p>
                      Monitor Spin & Win performance and coupon
                      activity.
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={async () => {
                      await loadHistory();
                    }}
                  >
                    ↻ Refresh
                  </button>
                </div>

                <div className="overview-grid">
                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        TOTAL SPINS
                      </span>
                      <span className="overview-icon">↻</span>
                    </div>

                    <div className="overview-value">
                      {history.length}
                    </div>

                    <div className="overview-meta">
                      Latest 100 records loaded
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        ISSUED COUPONS
                      </span>
                      <span className="overview-icon">✓</span>
                    </div>

                    <div className="overview-value">
                      {issuedCount}
                    </div>

                    <div className="overview-meta">
                      Currently issued
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        REDEEMED
                      </span>
                      <span className="overview-icon">✓</span>
                    </div>

                    <div className="overview-value">
                      {redeemedCount}
                    </div>

                    <div className="overview-meta">
                      Successfully redeemed
                    </div>
                  </div>

                  <div className="overview-card">
                    <div className="overview-card-top">
                      <span className="overview-label">
                        REDEMPTION RATE
                      </span>
                      <span className="overview-icon">%</span>
                    </div>

                    <div className="overview-value">
                      {redemptionRate.toFixed(1)}%
                    </div>

                    <div className="overview-meta">
                      Redeemed ÷ total spins
                    </div>
                  </div>
                </div>

                <div className="statistics-grid">
                  <div className="table-card statistics-card">
                    <div className="statistics-card-header">
                      <div>
                        <div className="eyebrow">
                          DISTRIBUTION
                        </div>
                        <h2>Prize Distribution</h2>
                      </div>

                      <span className="statistics-total">
                        {history.length} spins
                      </span>
                    </div>

                    {prizeDistribution.length === 0 ? (
                      <div className="empty-state small-empty">
                        No prize statistics available yet.
                      </div>
                    ) : (
                      <div className="statistics-list">
                        {prizeDistribution.map((item) => (
                          <div
                            className="statistics-row"
                            key={item.name}
                          >
                            <div className="statistics-row-top">
                              <strong>{item.name}</strong>

                              <span>
                                {item.count} (
                                {item.percentage.toFixed(1)}%)
                              </span>
                            </div>

                            <div className="statistics-progress">
                              <div
                                className="statistics-progress-fill"
                                style={{
                                  width: `${Math.min(
                                    item.percentage,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="table-card statistics-card">
                    <div className="statistics-card-header">
                      <div>
                        <div className="eyebrow">COUPONS</div>
                        <h2>Coupon Status</h2>
                      </div>

                      <span className="statistics-total">
                        {history.length} total
                      </span>
                    </div>

                    {couponStatusDistribution.length === 0 ? (
                      <div className="empty-state small-empty">
                        No coupon statistics available yet.
                      </div>
                    ) : (
                      <div className="coupon-status-list">
                        {couponStatusDistribution.map(
                          ([status, count]) => (
                            <div
                              className="coupon-status-row"
                              key={status}
                            >
                              <div>
                                <span
                                  className={getStatusClass(
                                    status
                                  )}
                                >
                                  {status}
                                </span>
                              </div>

                              <strong>{count}</strong>
                            </div>
                          )
                        )}

                        {otherCouponCount > 0 && (
                          <div className="statistics-footnote">
                            {otherCouponCount} record
                            {otherCouponCount !== 1
                              ? "s"
                              : ""}{" "}
                            with another status.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="section-heading">
                  <div>
                    <div className="eyebrow">ACTIVITY</div>
                    <h2>Recent Activity</h2>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => selectTab("history")}
                  >
                    View Full History →
                  </button>
                </div>

                <div className="table-card">
                  {recentActivity.length === 0 ? (
                    <div className="empty-state">
                      No activity available yet.
                    </div>
                  ) : (
                    <div className="history-table-wrap">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>DATE & TIME</th>
                            <th>MOBILE</th>
                            <th>PRIZE</th>
                            <th>COUPON</th>
                            <th>STATUS</th>
                          </tr>
                        </thead>

                        <tbody>
                          {recentActivity.map((record) => (
                            <tr key={record.id}>
                              <td>
                                {formatDateTime(record.created_at)}
                              </td>

                              <td>
                                <span className="mobile-number">
                                  {record.mobile}
                                </span>
                              </td>

                              <td>
                                <strong>
                                  {record.prize_name}
                                </strong>
                              </td>

                              <td>
                                <span className="history-coupon">
                                  {record.coupon_code}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={getStatusClass(
                                    record.coupon_status
                                  )}
                                >
                                  {record.coupon_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="history-note">
                  <div className="weight-info-icon">i</div>

                  <p>
                    Statistics are calculated from the latest 100
                    spin records loaded from Supabase. They will
                    update automatically when the history is
                    refreshed.
                  </p>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* PRIZE MODAL */}
      {showPrizeModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePrizeModal();
            }
          }}
        >
          <div className="prize-modal">
            <div className="modal-header">
              <div>
                <div className="eyebrow">
                  {editingPrize ? "EDIT PRIZE" : "NEW PRIZE"}
                </div>

                <h2>
                  {editingPrize
                    ? "Edit Prize"
                    : "Add New Prize"}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={closePrizeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form onSubmit={savePrize}>
              <div className="form-grid">
                <div className="form-field full">
                  <label>PRIZE NAME</label>

                  <input
                    type="text"
                    value={prizeForm.name}
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

                <div className="form-field full">
                  <label>DESCRIPTION</label>

                  <textarea
                    value={prizeForm.description}
                    onChange={(event) =>
                      setPrizeForm({
                        ...prizeForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="Optional prize description"
                    rows={3}
                  />
                </div>

                <div className="form-field">
                  <label>WEIGHT</label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={prizeForm.weight}
                    onChange={(event) =>
                      setPrizeForm({
                        ...prizeForm,
                        weight: event.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="form-field">
                  <label>SORT ORDER</label>

                  <input
                    type="number"
                    step="1"
                    value={prizeForm.sort_order}
                    onChange={(event) =>
                      setPrizeForm({
                        ...prizeForm,
                        sort_order: event.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="form-field">
                  <label>COUPON PREFIX</label>

                  <input
                    type="text"
                    maxLength={10}
                    value={prizeForm.coupon_prefix}
                    onChange={(event) =>
                      setPrizeForm({
                        ...prizeForm,
                        coupon_prefix:
                          event.target.value.toUpperCase(),
                      })
                    }
                    placeholder="SG10"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>STATUS</label>

                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={prizeForm.active}
                      onChange={(event) =>
                        setPrizeForm({
                          ...prizeForm,
                          active: event.target.checked,
                        })
                      }
                    />

                    <span className="switch" />

                    <span>
                      {prizeForm.active
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
                  onClick={closePrizeModal}
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
                    ? "Save Changes"
                    : "Add Prize"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const adminStyles = `
  * {
    box-sizing: border-box;
  }

  .admin-shell {
    min-height: 100vh;
    display: flex;
    background: #f6f7f9;
    color: #161616;
  }

  .sidebar {
    width: 245px;
    min-width: 245px;
    background: #111111;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 20;
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 27px 24px 28px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }

  .brand-logo {
    width: 39px;
    height: 39px;
    border-radius: 10px;
    background: #ffffff;
    color: #111111;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 800;
  }

  .brand-title {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.7px;
  }

  .brand-subtitle {
    margin-top: 2px;
    font-size: 9px;
    letter-spacing: 1.6px;
    color: #a7a7a7;
  }

  .sidebar-nav {
    padding: 22px 13px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .nav-item,
  .logout-button {
    width: 100%;
    border: 0;
    background: transparent;
    color: #aaaaaa;
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 12px 13px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    transition: 0.2s ease;
  }

  .nav-item:hover,
  .logout-button:hover {
    background: rgba(255,255,255,0.06);
    color: #ffffff;
  }

  .nav-item.active {
    background: #ffffff;
    color: #111111;
  }

  .nav-icon {
    width: 18px;
    text-align: center;
    font-size: 16px;
    flex-shrink: 0;
  }

  .sidebar-bottom {
    margin-top: auto;
    padding: 13px;
    border-top: 1px solid rgba(255,255,255,0.08);
  }

  .admin-main {
    margin-left: 245px;
    width: calc(100% - 245px);
    min-height: 100vh;
  }

  .admin-content {
    width: 100%;
    max-width: 1250px;
    margin: 0 auto;
    padding: 42px 35px 70px;
  }

  .page-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 25px;
    margin-bottom: 32px;
  }

  .eyebrow {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.7px;
    color: #999999;
    margin-bottom: 7px;
  }

  .page-heading h1 {
    margin: 0;
    font-size: 34px;
    line-height: 1.05;
    letter-spacing: -1.2px;
  }

  .page-heading p {
    margin: 9px 0 0;
    color: #777777;
    font-size: 13px;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px;
    margin-bottom: 38px;
  }

  .overview-card {
    min-height: 125px;
    padding: 20px;
    border-radius: 15px;
    background: #ffffff;
    border: 1px solid #e7e7e7;
    box-shadow: 0 2px 8px rgba(0,0,0,0.025);
  }

  .overview-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .overview-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.3px;
    color: #8c8c8c;
  }

  .overview-icon {
    width: 25px;
    height: 25px;
    border-radius: 7px;
    background: #f2f2f2;
    color: #333333;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
  }

  .overview-value {
    margin-top: 12px;
    font-size: 28px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.7px;
  }

  .overview-meta {
    margin-top: 9px;
    font-size: 11px;
    color: #999999;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 15px;
  }

  .section-heading h2,
  .history-table-header h2,
  .history-filter-heading h2,
  .statistics-card-header h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: -0.3px;
  }

  .table-card,
  .history-table-card {
    background: #ffffff;
    border: 1px solid #e7e7e7;
    border-radius: 15px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.025);
    overflow: hidden;
    margin-bottom: 30px;
  }

  .campaign-card {
    padding: 23px;
  }

  .campaign-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }

  .campaign-row > div {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .campaign-label {
    font-size: 9px;
    color: #999999;
    font-weight: 800;
    letter-spacing: 1.1px;
  }

  .campaign-row strong {
    font-size: 14px;
  }

  .weight-list {
    padding: 8px 23px;
  }

  .weight-row {
    min-height: 62px;
    display: grid;
    grid-template-columns: 180px 1fr 75px;
    align-items: center;
    gap: 20px;
    border-bottom: 1px solid #eeeeee;
  }

  .weight-row:last-child {
    border-bottom: 0;
  }

  .weight-name {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13px;
    font-weight: 700;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .active-dot {
    background: #111111;
  }

  .inactive-dot {
    background: #cfcfcf;
  }

  .weight-bar-wrap {
    height: 7px;
    background: #eeeeee;
    border-radius: 10px;
    overflow: hidden;
  }

  .weight-bar {
    height: 100%;
    background: #111111;
    border-radius: 10px;
    min-width: 0;
  }

  .weight-value {
    font-size: 11px;
    font-weight: 700;
    text-align: right;
    color: #666666;
  }

  .quick-actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin-top: 3px;
  }

  .quick-action {
    border: 1px solid #e7e7e7;
    background: #ffffff;
    border-radius: 13px;
    padding: 18px 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    text-align: left;
    cursor: pointer;
    transition: 0.2s ease;
  }

  .quick-action:hover {
    border-color: #bdbdbd;
    transform: translateY(-1px);
  }

  .quick-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #111111;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }

  .quick-action span:last-child {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .quick-action strong {
    font-size: 13px;
  }

  .quick-action small {
    color: #999999;
    font-size: 11px;
  }

  .primary-button,
  .secondary-button {
    border-radius: 9px;
    padding: 11px 17px;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    transition: 0.2s ease;
  }

  .primary-button {
    border: 1px solid #111111;
    background: #111111;
    color: #ffffff;
  }

  .primary-button:hover {
    background: #2a2a2a;
  }

  .secondary-button {
    border: 1px solid #dedede;
    background: #ffffff;
    color: #222222;
  }

  .secondary-button:hover {
    border-color: #aaaaaa;
  }

  .text-button {
    border: 0;
    background: transparent;
    color: #444444;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .prize-table-wrap,
  .history-table-wrap {
    width: 100%;
    overflow-x: auto;
  }

  .prize-table,
  .history-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 850px;
  }

  .prize-table th,
  .history-table th {
    padding: 15px 18px;
    text-align: left;
    font-size: 8px;
    letter-spacing: 1.2px;
    color: #999999;
    background: #fafafa;
    border-bottom: 1px solid #eeeeee;
    white-space: nowrap;
  }

  .prize-table td,
  .history-table td {
    padding: 16px 18px;
    border-bottom: 1px solid #eeeeee;
    font-size: 12px;
    vertical-align: middle;
  }

  .prize-table tbody tr:last-child td,
  .history-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .prize-name-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .prize-name-cell strong {
    font-size: 13px;
  }

  .prize-name-cell small {
    color: #999999;
    font-size: 10px;
  }

  .coupon-prefix,
  .history-coupon {
    display: inline-flex;
    align-items: center;
    padding: 5px 8px;
    border-radius: 6px;
    background: #f3f3f3;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.3px;
  }

  .prize-status,
  .history-status {
    display: inline-flex;
    align-items: center;
    padding: 5px 9px;
    border-radius: 20px;
    font-size: 9px;
    font-weight: 800;
    text-transform: capitalize;
  }

  .status-active,
  .history-status.issued {
    background: #eeeeee;
    color: #222222;
  }

  .status-inactive,
  .history-status.other {
    background: #f4f4f4;
    color: #999999;
  }

  .history-status.redeemed {
    background: #111111;
    color: #ffffff;
  }

  .table-actions {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .action-button {
    border: 1px solid #dddddd;
    background: #ffffff;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 9px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .action-button:hover {
    background: #f5f5f5;
  }

  .action-button.delete {
    color: #a00000;
  }

  .weight-info,
  .history-note {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 15px 17px;
    background: #fafafa;
    border: 1px solid #e7e7e7;
    border-radius: 11px;
    margin-top: 5px;
  }

  .weight-info-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #111111;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .weight-info strong {
    font-size: 11px;
  }

  .weight-info p,
  .history-note p {
    margin: 4px 0 0;
    color: #777777;
    font-size: 10px;
    line-height: 1.6;
  }

  .empty-state {
    min-height: 210px;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .empty-state.small-empty {
    min-height: 150px;
  }

  .empty-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: #f0f0f0;
    color: #777777;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    margin-bottom: 13px;
  }

  .empty-state h3,
  .history-empty h3 {
    margin: 0;
    font-size: 14px;
  }

  .empty-state p,
  .history-empty p {
    margin: 7px 0 17px;
    color: #999999;
    font-size: 11px;
  }

  .history-table-header {
    padding: 20px 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #eeeeee;
  }

  .history-count {
    color: #999999;
    font-size: 10px;
    font-weight: 700;
  }

  .history-table td {
    white-space: nowrap;
  }

  .mobile-number {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1px;
  }

  .history-empty {
    min-height: 250px;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    padding: 40px 20px;
  }

  /* Stage 3C filters */

  .history-filter-card {
    background: #ffffff;
    border: 1px solid #e7e7e7;
    border-radius: 15px;
    padding: 20px;
    margin-bottom: 15px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.025);
  }

  .history-filter-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 18px;
  }

  .history-filters {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr 1fr;
    gap: 12px;
  }

  .history-filter {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .history-filter label {
    font-size: 8px;
    font-weight: 800;
    color: #999999;
    letter-spacing: 1.1px;
  }

  .history-filter input,
  .history-filter select {
    width: 100%;
    height: 38px;
    border: 1px solid #dddddd;
    border-radius: 8px;
    background: #ffffff;
    color: #222222;
    padding: 0 11px;
    font-size: 11px;
    outline: none;
  }

  .history-filter input:focus,
  .history-filter select:focus {
    border-color: #999999;
  }

  .clear-filter-button {
    border: 1px solid #dedede;
    background: #ffffff;
    color: #444444;
    border-radius: 7px;
    padding: 8px 11px;
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
  }

  .clear-filter-button:hover {
    background: #f5f5f5;
  }

  /* Statistics */

  .statistics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin-bottom: 30px;
  }

  .statistics-card {
    margin-bottom: 0;
  }

  .statistics-card-header {
    padding: 20px 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #eeeeee;
  }

  .statistics-total {
    color: #999999;
    font-size: 10px;
    font-weight: 700;
  }

  .statistics-list {
    padding: 7px 22px 14px;
  }

  .statistics-row {
    padding: 14px 0;
    border-bottom: 1px solid #eeeeee;
  }

  .statistics-row:last-child {
    border-bottom: 0;
  }

  .statistics-row-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 8px;
  }

  .statistics-row-top strong {
    font-size: 11px;
  }

  .statistics-row-top span {
    color: #777777;
    font-size: 10px;
    font-weight: 700;
  }

  .statistics-progress {
    width: 100%;
    height: 6px;
    border-radius: 10px;
    background: #eeeeee;
    overflow: hidden;
  }

  .statistics-progress-fill {
    height: 100%;
    min-width: 0;
    background: #111111;
    border-radius: 10px;
  }

  .coupon-status-list {
    padding: 8px 22px 18px;
  }

  .coupon-status-row {
    min-height: 51px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #eeeeee;
  }

  .coupon-status-row:last-of-type {
    border-bottom: 0;
  }

  .coupon-status-row strong {
    font-size: 13px;
  }

  .statistics-footnote {
    padding-top: 14px;
    color: #999999;
    font-size: 10px;
  }

  /* Modal */

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.48);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 100;
  }

  .prize-modal {
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }

  .modal-header {
    padding: 22px 24px 18px;
    border-bottom: 1px solid #eeeeee;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 21px;
  }

  .modal-close {
    width: 30px;
    height: 30px;
    border: 0;
    background: #f2f2f2;
    border-radius: 8px;
    cursor: pointer;
    font-size: 19px;
    color: #555555;
  }

  .prize-modal form {
    padding: 23px 24px 24px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 17px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .form-field.full {
    grid-column: 1 / -1;
  }

  .form-field > label {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 1.1px;
    color: #888888;
  }

  .form-field input,
  .form-field textarea {
    width: 100%;
    border: 1px solid #dddddd;
    border-radius: 8px;
    padding: 10px 11px;
    outline: none;
    font-size: 12px;
    font-family: inherit;
    resize: vertical;
  }

  .form-field input:focus,
  .form-field textarea:focus {
    border-color: #999999;
  }

  .switch-row {
    min-height: 39px;
    display: flex;
    align-items: center;
    gap: 9px;
    cursor: pointer;
    font-size: 11px;
    color: #555555;
  }

  .switch-row input {
    display: none;
  }

  .switch {
    width: 35px;
    height: 20px;
    border-radius: 20px;
    background: #d3d3d3;
    position: relative;
    transition: 0.2s ease;
  }

  .switch::after {
    content: "";
    position: absolute;
    width: 14px;
    height: 14px;
    top: 3px;
    left: 3px;
    border-radius: 50%;
    background: #ffffff;
    transition: 0.2s ease;
  }

  .switch-row input:checked + .switch {
    background: #111111;
  }

  .switch-row input:checked + .switch::after {
    left: 18px;
  }

  .modal-footer {
    margin-top: 23px;
    padding-top: 18px;
    border-top: 1px solid #eeeeee;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .admin-loading {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 13px;
    background: #f6f7f9;
    color: #777777;
    font-size: 12px;
  }

  .loading-spinner {
    width: 29px;
    height: 29px;
    border: 3px solid #dddddd;
    border-top-color: #111111;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1100px) {
    .overview-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .campaign-row {
      grid-template-columns: repeat(2, 1fr);
    }

    .history-filters {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 800px) {
    .sidebar {
      width: 205px;
      min-width: 205px;
    }

    .admin-main {
      margin-left: 205px;
      width: calc(100% - 205px);
    }

    .admin-content {
      padding: 32px 22px 55px;
    }

    .page-heading {
      align-items: flex-start;
      flex-direction: column;
    }

    .statistics-grid {
      grid-template-columns: 1fr;
    }

    .statistics-card {
      margin-bottom: 0;
    }
  }

  @media (max-width: 650px) {
    .sidebar {
      position: relative;
      width: 100%;
      min-width: 0;
      height: auto;
      min-height: auto;
    }

    .admin-shell {
      display: block;
    }

    .admin-main {
      margin-left: 0;
      width: 100%;
    }

    .sidebar-nav {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
    }

    .sidebar-bottom {
      border-top: 0;
      padding-top: 0;
    }

    .overview-grid,
    .quick-actions,
    .campaign-row,
    .history-filters {
      grid-template-columns: 1fr;
    }

    .admin-content {
      padding: 28px 16px 45px;
    }

    .page-heading h1 {
      font-size: 29px;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .form-field.full {
      grid-column: auto;
    }

    .history-filter-heading {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;
