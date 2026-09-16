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

type Spin = {
  id: string;
  mobile: string;
  prize_id: string | null;
  coupon_id: string | null;
  created_at: string;
};

type Coupon = {
  id: string;
  code: string;
  status: string;
};

type SpinHistory = {
  id: string;
  mobile: string;
  prize_id: string | null;
  coupon_id: string | null;
  created_at: string;
  prize_name: string;
  coupon_code: string;
  coupon_status: string;
};

export default function AdminPage() {
  const router = useRouter();

  const [adminEmail, setAdminEmail] = useState("");

  // ============================================================
  // PRIZES
  // ============================================================

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(true);

  const [showPrizeForm, setShowPrizeForm] = useState(false);
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [savingPrize, setSavingPrize] = useState(false);

  const [prizeForm, setPrizeForm] = useState<PrizeForm>({
    name: "",
    description: "",
    weight: "1",
    coupon_prefix: "",
    sort_order: "1",
    active: true,
  });

  // ============================================================
  // SPIN HISTORY - STAGE 3B
  // ============================================================

  const [history, setHistory] = useState<SpinHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // ============================================================
  // INITIAL LOAD
  // ============================================================

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

      await Promise.all([
        loadPrizes(),
        loadHistory(),
      ]);
    } catch (error) {
      console.error("Admin initialization error:", error);
      router.replace("/admin/login");
    }
  }

  // ============================================================
  // LOAD PRIZES
  // ============================================================

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
      setPrizes([]);
    } else {
      setPrizes((data || []) as Prize[]);
    }

    setLoadingPrizes(false);
  }

  // ============================================================
  // LOAD SPIN HISTORY
  // ============================================================

  async function loadHistory(isRefresh = false) {
    if (isRefresh) {
      setRefreshingHistory(true);
    } else {
      setLoadingHistory(true);
    }

    setHistoryError("");

    try {
      // ----------------------------------------------------------
      // 1. Load spins
      // ----------------------------------------------------------

      const {
        data: spinsData,
        error: spinsError,
      } = await supabase
        .from("spins")
        .select(
          "id, mobile, prize_id, coupon_id, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (spinsError) {
        throw new Error(
          `Unable to load spins: ${spinsError.message}`
        );
      }

      const spins = (spinsData || []) as Spin[];

      // If there are no spins, stop here.
      if (spins.length === 0) {
        setHistory([]);
        return;
      }

      // ----------------------------------------------------------
      // 2. Get unique prize IDs
      // ----------------------------------------------------------

      const prizeIds = Array.from(
        new Set(
          spins
            .map((spin) => spin.prize_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      // ----------------------------------------------------------
      // 3. Get unique coupon IDs
      // ----------------------------------------------------------

      const couponIds = Array.from(
        new Set(
          spins
            .map((spin) => spin.coupon_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      // ----------------------------------------------------------
      // 4. Load prizes and coupons separately
      // ----------------------------------------------------------

      let prizesMap: Record<string, Prize> = {};
      let couponsMap: Record<string, Coupon> = {};

      if (prizeIds.length > 0) {
        const {
          data: prizeData,
          error: prizeError,
        } = await supabase
          .from("prizes")
          .select(
            "id, name, description, weight, active, sort_order, coupon_prefix"
          )
          .in("id", prizeIds);

        if (prizeError) {
          throw new Error(
            `Unable to load prizes: ${prizeError.message}`
          );
        }

        (prizeData || []).forEach((prize) => {
          prizesMap[prize.id] = prize as Prize;
        });
      }

      if (couponIds.length > 0) {
        const {
          data: couponData,
          error: couponError,
        } = await supabase
          .from("coupons")
          .select("id, code, status")
          .in("id", couponIds);

        if (couponError) {
          throw new Error(
            `Unable to load coupons: ${couponError.message}`
          );
        }

        (couponData || []).forEach((coupon) => {
          couponsMap[coupon.id] = coupon as Coupon;
        });
      }

      // ----------------------------------------------------------
      // 5. Combine the data
      // ----------------------------------------------------------

      const combinedHistory: SpinHistory[] = spins.map((spin) => {
        const prize = spin.prize_id
          ? prizesMap[spin.prize_id]
          : undefined;

        const coupon = spin.coupon_id
          ? couponsMap[spin.coupon_id]
          : undefined;

        return {
          id: spin.id,
          mobile: spin.mobile,
          prize_id: spin.prize_id,
          coupon_id: spin.coupon_id,
          created_at: spin.created_at,
          prize_name: prize?.name || "Prize unavailable",
          coupon_code: coupon?.code || "—",
          coupon_status: coupon?.status || "—",
        };
      });

      setHistory(combinedHistory);
    } catch (error) {
      console.error("Spin history error:", error);

      setHistoryError(
        error instanceof Error
          ? error.message
          : "Unable to load spin history."
      );

      setHistory([]);
    } finally {
      setLoadingHistory(false);
      setRefreshingHistory(false);
    }
  }

  // ============================================================
  // ADD PRIZE
  // ============================================================

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

  // ============================================================
  // EDIT PRIZE
  // ============================================================

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

  // ============================================================
  // SAVE PRIZE
  // ============================================================

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
      coupon_prefix:
        prizeForm.coupon_prefix.trim().toUpperCase() || null,
      sort_order: sortOrder,
      active: prizeForm.active,
    };

    try {
      if (editingPrizeId) {
        const { error } = await supabase
          .from("prizes")
          .update(payload)
          .eq("id", editingPrizeId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("prizes")
          .insert(payload);

        if (error) {
          throw error;
        }
      }

      setShowPrizeForm(false);
      setEditingPrizeId(null);

      await loadPrizes();
    } catch (error) {
      console.error("Save prize error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to save prize."
      );
    } finally {
      setSavingPrize(false);
    }
  }

  // ============================================================
  // TOGGLE PRIZE
  // ============================================================

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

  // ============================================================
  // DELETE PRIZE
  // ============================================================

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
        `Unable to delete prize.\n\n${error.message}\n\nIf this prize has already been used in a spin, deactivate it instead.`
      );

      return;
    }

    await loadPrizes();
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  // ============================================================
  // HELPERS
  // ============================================================

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

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ======================================================== */}
      {/* HEADER */}
      {/* ======================================================== */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
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
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* MAIN */}
      {/* ======================================================== */}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* PAGE TITLE */}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Spin &amp; Win Dashboard
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Manage prizes and monitor customer spin activity.
          </p>
        </div>

        {/* ====================================================== */}
        {/* STATS */}
        {/* ====================================================== */}

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
              Total Spins Loaded
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {history.length}
            </p>
          </div>
        </div>

        {/* ====================================================== */}
        {/* PRIZE MANAGEMENT */}
        {/* ====================================================== */}

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
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              + Add Prize
            </button>
          </div>

          {/* PRIZE FORM */}

          {showPrizeForm && (
            <div className="border-b bg-gray-50 px-5 py-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {editingPrizeId
                      ? "Edit Prize"
                      : "Add New Prize"}
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Higher weight = higher chance of winning.
                  </p>
                </div>

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
                        coupon_prefix:
                          e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. SG1000"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

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

          {/* PRIZE TABLE */}

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
                  Add your first prize to start configuring the
                  wheel.
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
                    <tr
                      key={prize.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">
                          {prize.name}
                        </p>

                        {prize.description && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {prize.description}
                          </p>
                        )}
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
                          {prize.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              togglePrize(prize)
                            }
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                          >
                            {prize.active
                              ? "Deactivate"
                              : "Activate"}
                          </button>

                          <button
                            onClick={() =>
                              openEditPrizeForm(prize)
                            }
                            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              deletePrize(prize)
                            }
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

        {/* ====================================================== */}
        {/* STAGE 3B - SPIN HISTORY */}
        {/* ====================================================== */}

        <section className="rounded-xl border bg-white shadow-sm">
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
                Latest 100 customer spins and generated coupons.
              </p>
            </div>

            <button
              onClick={() => loadHistory(true)}
              disabled={refreshingHistory}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className={
                  refreshingHistory ? "animate-spin" : ""
                }
              >
                ↻
              </span>

              {refreshingHistory
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          {/* ERROR */}

          {historyError && (
            <div className="border-b bg-red-50 px-5 py-4">
              <p className="text-sm font-medium text-red-700">
                {historyError}
              </p>

              <button
                onClick={() => loadHistory(true)}
                className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          )}

          {/* HISTORY TABLE */}

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
                  No spins found
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Spin records will appear here after customers
                  use the wheel.
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
                  {history.map((spin) => (
                    <tr
                      key={spin.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="text-sm text-gray-700">
                          {formatDateTime(
                            spin.created_at
                          )}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="font-mono text-sm text-gray-700">
                          {maskMobile(spin.mobile)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-gray-900">
                          {spin.prize_name}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        {spin.coupon_code !== "—" ? (
                          <span className="rounded-md bg-gray-100 px-2.5 py-1.5 font-mono text-xs font-semibold text-gray-800">
                            {spin.coupon_code}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">
                            —
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        {spin.coupon_status !== "—" ? (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getCouponStatusClass(
                              spin.coupon_status
                            )}`}
                          >
                            {spin.coupon_status}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* FOOTER */}

          {!loadingHistory && history.length > 0 && (
            <div className="border-t bg-gray-50 px-5 py-4">
              <p className="text-xs text-gray-500">
                Showing the latest {history.length} spin
                {history.length === 1 ? "" : "s"}.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* ======================================================== */}
      {/* FOOTER */}
      {/* ======================================================== */}

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-gray-400 sm:px-6 lg:px-8">
          Singhagiri Spin &amp; Win Admin Panel
        </div>
      </footer>
    </div>
  );
}
