"use client";

import { useEffect, useState } from "react";
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

type SpinHistory = {
  id: string;
  mobile: string;
  created_at: string;
  prize_id: string | null;
  coupon_id: string | null;
  prizes:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  coupons:
    | {
        code: string;
        status: string;
      }
    | {
        code: string;
        status: string;
      }[]
    | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [adminEmail, setAdminEmail] = useState("");

  // -----------------------------
  // Prize Management
  // -----------------------------
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(true);

  const [showPrizeForm, setShowPrizeForm] = useState(false);
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);

  const [prizeForm, setPrizeForm] = useState<PrizeForm>({
    name: "",
    description: "",
    weight: "1",
    coupon_prefix: "",
    sort_order: "0",
    active: true,
  });

  const [savingPrize, setSavingPrize] = useState(false);

  // -----------------------------
  // Spin History
  // -----------------------------
  const [history, setHistory] = useState<SpinHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // -----------------------------
  // Page initialization
  // -----------------------------
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

      // Check whether the logged-in user is an admin
      const { data: adminUser, error } = await supabase
        .from("admin_users")
        .select("user_id, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Admin check error:", error);
        router.replace("/admin/login");
        return;
      }

      if (!adminUser) {
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      setAdminEmail(adminUser.email || user.email || "");

      await Promise.all([loadPrizes(), loadHistory()]);
    } catch (error) {
      console.error("Admin initialization error:", error);
      router.replace("/admin/login");
    }
  }

  // -----------------------------
  // Load Prizes
  // -----------------------------
  async function loadPrizes() {
    setLoadingPrizes(true);

    const { data, error } = await supabase
      .from("prizes")
      .select(
        "id, name, description, weight, active, sort_order, coupon_prefix"
      )
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Load prizes error:", error);
    } else {
      setPrizes((data || []) as Prize[]);
    }

    setLoadingPrizes(false);
  }

  // -----------------------------
  // Load Spin History
  // -----------------------------
  async function loadHistory(isRefresh = false) {
    if (isRefresh) {
      setRefreshingHistory(true);
    } else {
      setLoadingHistory(true);
    }

    setHistoryError("");

    const { data, error } = await supabase
      .from("spins")
      .select(`
        id,
        mobile,
        created_at,
        prize_id,
        coupon_id,
        prizes (
          name
        ),
        coupons (
          code,
          status
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Load spin history error:", error);
      setHistoryError("Unable to load spin history.");
      setHistory([]);
    } else {
      setHistory((data || []) as SpinHistory[]);
    }

    if (isRefresh) {
      setRefreshingHistory(false);
    } else {
      setLoadingHistory(false);
    }
  }

  // -----------------------------
  // Add Prize
  // -----------------------------
  function openAddPrizeForm() {
    setEditingPrizeId(null);

    setPrizeForm({
      name: "",
      description: "",
      weight: "1",
      coupon_prefix: "",
      sort_order: String(prizes.length + 1),
      active: true,
    });

    setShowPrizeForm(true);
  }

  // -----------------------------
  // Edit Prize
  // -----------------------------
  function openEditPrizeForm(prize: Prize) {
    setEditingPrizeId(prize.id);

    setPrizeForm({
      name: prize.name,
      description: prize.description || "",
      weight: String(prize.weight),
      coupon_prefix: prize.coupon_prefix || "",
      sort_order: String(prize.sort_order),
      active: prize.active,
    });

    setShowPrizeForm(true);
  }

  // -----------------------------
  // Save Prize
  // -----------------------------
  async function savePrize() {
    if (!prizeForm.name.trim()) {
      alert("Please enter a prize name.");
      return;
    }

    const weight = Number(prizeForm.weight);

    if (Number.isNaN(weight) || weight < 0) {
      alert("Please enter a valid weight.");
      return;
    }

    const sortOrder = Number(prizeForm.sort_order);

    if (Number.isNaN(sortOrder)) {
      alert("Please enter a valid sort order.");
      return;
    }

    setSavingPrize(true);

    const payload = {
      name: prizeForm.name.trim(),
      description: prizeForm.description.trim() || null,
      weight,
      coupon_prefix: prizeForm.coupon_prefix.trim().toUpperCase() || null,
      sort_order: sortOrder,
      active: prizeForm.active,
    };

    if (editingPrizeId) {
      const { error } = await supabase
        .from("prizes")
        .update(payload)
        .eq("id", editingPrizeId);

      if (error) {
        console.error("Update prize error:", error);
        alert(`Unable to update prize: ${error.message}`);
      } else {
        setShowPrizeForm(false);
        await loadPrizes();
      }
    } else {
      const { error } = await supabase.from("prizes").insert(payload);

      if (error) {
        console.error("Add prize error:", error);
        alert(`Unable to add prize: ${error.message}`);
      } else {
        setShowPrizeForm(false);
        await loadPrizes();
      }
    }

    setSavingPrize(false);
  }

  // -----------------------------
  // Toggle Prize Active Status
  // -----------------------------
  async function togglePrize(prize: Prize) {
    const { error } = await supabase
      .from("prizes")
      .update({
        active: !prize.active,
      })
      .eq("id", prize.id);

    if (error) {
      console.error("Toggle prize error:", error);
      alert(`Unable to update prize: ${error.message}`);
      return;
    }

    await loadPrizes();
  }

  // -----------------------------
  // Delete Prize
  // -----------------------------
  async function deletePrize(prize: Prize) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${prize.name}"?`
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("prizes")
      .delete()
      .eq("id", prize.id);

    if (error) {
      console.error("Delete prize error:", error);
      alert(
        `Unable to delete prize.\n\n${error.message}\n\nIf this prize has already been used in a spin, you may need to deactivate it instead.`
      );
      return;
    }

    await loadPrizes();
  }

  // -----------------------------
  // Logout
  // -----------------------------
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  // -----------------------------
  // Helper: Mask Mobile
  // -----------------------------
  function maskMobile(mobile: string) {
    if (!mobile) {
      return "—";
    }

    const value = mobile.replace(/\s+/g, "");

    if (value.length <= 7) {
      return value;
    }

    return `${value.slice(0, 5)}••••${value.slice(-2)}`;
  }

  // -----------------------------
  // Helper: Date & Time
  // -----------------------------
  function formatDateTime(value: string) {
    if (!value) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat("en-LK", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  // -----------------------------
  // Helper: Related Prize
  // -----------------------------
  function getPrizeName(
    prize:
      | {
          name: string;
        }
      | {
          name: string;
        }[]
      | null
  ) {
    if (!prize) {
      return "—";
    }

    if (Array.isArray(prize)) {
      return prize[0]?.name || "—";
    }

    return prize.name || "—";
  }

  // -----------------------------
  // Helper: Related Coupon
  // -----------------------------
  function getCoupon(
    coupon:
      | {
          code: string;
          status: string;
        }
      | {
          code: string;
          status: string;
        }[]
      | null
  ) {
    if (!coupon) {
      return null;
    }

    if (Array.isArray(coupon)) {
      return coupon[0] || null;
    }

    return coupon;
  }

  // -----------------------------
  // Coupon Status Style
  // -----------------------------
  function getCouponStatusClass(status: string) {
    const normalized = status?.toLowerCase();

    if (
      normalized === "active" ||
      normalized === "issued" ||
      normalized === "available"
    ) {
      return "bg-green-100 text-green-700";
    }

    if (
      normalized === "redeemed" ||
      normalized === "used"
    ) {
      return "bg-blue-100 text-blue-700";
    }

    if (
      normalized === "expired" ||
      normalized === "cancelled" ||
      normalized === "canceled"
    ) {
      return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-700";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ========================================================= */}
      {/* HEADER */}
      {/* ========================================================= */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-lg font-bold text-white">
                S
              </div>

              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Singhagiri
                </h1>

                <p className="text-xs text-gray-500">
                  Spin &amp; Win Admin
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-900">
                {adminEmail}
              </p>

              <p className="text-xs text-gray-500">
                Administrator
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN */}
      {/* ========================================================= */}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Heading */}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Spin &amp; Win Dashboard
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Manage prizes and monitor customer spin activity.
          </p>
        </div>

        {/* ========================================================= */}
        {/* QUICK STATS */}
        {/* ========================================================= */}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Prizes
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {prizes.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Active Prizes
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {prizes.filter((prize) => prize.active).length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Recent Spins
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {history.length}
            </p>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PRIZE MANAGEMENT */}
        {/* ========================================================= */}

        <section className="mb-10 rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Prize Management
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Manage prizes, winning weights and coupon prefixes.
              </p>
            </div>

            <button
              onClick={openAddPrizeForm}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              + Add Prize
            </button>
          </div>

          {/* Prize Form */}

          {showPrizeForm && (
            <div className="border-b bg-gray-50 px-5 py-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {editingPrizeId ? "Edit Prize" : "Add New Prize"}
                  </h4>

                  <p className="text-sm text-gray-500">
                    Configure the prize details below.
                  </p>
                </div>

                <button
                  onClick={() => setShowPrizeForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Name */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Prize Name
                  </label>

                  <input
                    type="text"
                    value={prizeForm.name}
                    onChange={(e) =>
                      setPrizeForm({
                        ...prizeForm,
                        name: e.target.value,
                      })
                    }
                    placeholder="e.g. Rs. 1,000 Voucher"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                {/* Description */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Description
                  </label>

                  <input
                    type="text"
                    value={prizeForm.description}
                    onChange={(e) =>
                      setPrizeForm({
                        ...prizeForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Optional description"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                {/* Weight */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Winning Weight
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={prizeForm.weight}
                    onChange={(e) =>
                      setPrizeForm({
                        ...prizeForm,
                        weight: e.target.value,
                      })
                    }
                    placeholder="1"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Higher weight = higher chance of winning.
                  </p>
                </div>

                {/* Coupon Prefix */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Coupon Prefix
                  </label>

                  <input
                    type="text"
                    maxLength={10}
                    value={prizeForm.coupon_prefix}
                    onChange={(e) =>
                      setPrizeForm({
                        ...prizeForm,
                        coupon_prefix: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. SG1000"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                {/* Sort Order */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Sort Order
                  </label>

                  <input
                    type="number"
                    value={prizeForm.sort_order}
                    onChange={(e) =>
                      setPrizeForm({
                        ...prizeForm,
                        sort_order: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                {/* Active */}

                <div className="flex items-center">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={prizeForm.active}
                      onChange={(e) =>
                        setPrizeForm({
                          ...prizeForm,
                          active: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />

                    <span className="text-sm font-medium text-gray-700">
                      Prize is active
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowPrizeForm(false)}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  onClick={savePrize}
                  disabled={savingPrize}
                  className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPrize
                    ? "Saving..."
                    : editingPrizeId
                    ? "Update Prize"
                    : "Add Prize"}
                </button>
              </div>
            </div>
          )}

          {/* Prize Table */}

          <div className="overflow-x-auto">
            {loadingPrizes ? (
              <div className="px-5 py-12 text-center text-sm text-gray-500">
                Loading prizes...
              </div>
            ) : prizes.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="font-medium text-gray-900">
                  No prizes found
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Add your first prize to start configuring the wheel.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Prize
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Weight
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Prefix
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Order
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 bg-white">
                  {prizes.map((prize) => (
                    <tr key={prize.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {prize.name}
                          </p>

                          {prize.description && (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {prize.description}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {prize.weight}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                          {prize.coupon_prefix || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {prize.sort_order}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            prize.active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {prize.active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => togglePrize(prize)}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                          >
                            {prize.active ? "Deactivate" : "Activate"}
                          </button>

                          <button
                            onClick={() => openEditPrizeForm(prize)}
                            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => deletePrize(prize)}
                            className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* STAGE 3B - SPIN / WINNER HISTORY */}
        {/* ========================================================= */}

        <section className="rounded-xl border bg-white shadow-sm">
          {/* History Header */}

          <div className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-gray-900">
                  Spin / Winner History
                </h3>

                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                  {history.length}
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                View recent customer spins, prizes and generated coupons.
              </p>
            </div>

            <button
              onClick={() => loadHistory(true)}
              disabled={refreshingHistory}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className={
                  refreshingHistory ? "animate-spin" : ""
                }
              >
                ↻
              </span>

              {refreshingHistory ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Error */}

          {historyError && (
            <div className="border-b bg-red-50 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-red-700">
                  {historyError}
                </p>

                <button
                  onClick={() => loadHistory(true)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* History Table */}

          <div className="overflow-x-auto">
            {loadingHistory ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />

                <p className="text-sm text-gray-500">
                  Loading spin history...
                </p>
              </div>
            ) : history.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
                  🎡
                </div>

                <p className="mt-4 font-semibold text-gray-900">
                  No spins yet
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Customer spin activity will appear here once users start
                  playing.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Date &amp; Time
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Mobile
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Prize
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Coupon
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 bg-white">
                  {history.map((spin) => {
                    const coupon = getCoupon(spin.coupons);

                    return (
                      <tr
                        key={spin.id}
                        className="transition hover:bg-gray-50"
                      >
                        {/* Date */}

                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            {formatDateTime(spin.created_at)}
                          </p>
                        </td>

                        {/* Mobile */}

                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="font-mono text-sm text-gray-700">
                            {maskMobile(spin.mobile)}
                          </span>
                        </td>

                        {/* Prize */}

                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {getPrizeName(spin.prizes)}
                          </p>
                        </td>

                        {/* Coupon */}

                        <td className="whitespace-nowrap px-5 py-4">
                          {coupon?.code ? (
                            <span className="rounded-md bg-gray-100 px-2.5 py-1.5 font-mono text-xs font-semibold text-gray-800">
                              {coupon.code}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">
                              —
                            </span>
                          )}
                        </td>

                        {/* Status */}

                        <td className="whitespace-nowrap px-5 py-4">
                          {coupon?.status ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getCouponStatusClass(
                                coupon.status
                              )}`}
                            >
                              {coupon.status}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* History Footer */}

          {!loadingHistory && history.length > 0 && (
            <div className="border-t bg-gray-50 px-5 py-4">
              <p className="text-xs text-gray-500">
                Showing the latest {history.length} spin
                {history.length === 1 ? "" : "s"}. Search and filtering
                will be added in Stage 3C.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* ========================================================= */}
      {/* FOOTER */}
      {/* ========================================================= */}

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-gray-400 sm:px-6 lg:px-8">
          Singhagiri Spin &amp; Win Admin Panel
        </div>
      </footer>
    </div>
  );
}
