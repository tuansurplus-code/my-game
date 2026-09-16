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

type Spin = {
  id: string;
  mobile: string;
  prize_id: string;
  coupon_id: string;
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

export default function AdminPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(true);

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(false);

  const [history, setHistory] = useState<SpinHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [form, setForm] = useState<PrizeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    setChecking(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.replace("/admin/login");
      return;
    }

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminError || !adminUser) {
      await supabase.auth.signOut();
      router.replace("/admin/login");
      return;
    }

    setEmail(session.user.email || "");
    setChecking(false);

    await Promise.all([loadPrizes(), loadHistory()]);
  }

  async function loadPrizes() {
    setLoadingPrizes(true);
    setError("");

    const { data, error: prizesError } = await supabase
      .from("prizes")
      .select(
        "id,name,description,weight,active,sort_order,coupon_prefix"
      )
      .order("sort_order", { ascending: true });

    if (prizesError) {
      setError(prizesError.message);
      setPrizes([]);
    } else {
      setPrizes((data || []) as Prize[]);
    }

    setLoadingPrizes(false);
  }

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
       * Get spin records.
       *
       * IMPORTANT:
       * We intentionally do NOT use:
       *
       * prizes(name)
       * coupons(code,status)
       *
       * because the previous nested relationship query caused
       * problems with this Supabase setup.
       */
      const { data: spinsData, error: spinsError } = await supabase
        .from("spins")
        .select("id,mobile,prize_id,coupon_id,created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (spinsError) {
        throw new Error(`Spins: ${spinsError.message}`);
      }

      const spins = (spinsData || []) as Spin[];

      if (spins.length === 0) {
        setHistory([]);
        return;
      }

      /*
       * STEP 2
       * Get unique prize IDs and coupon IDs.
       */
      const prizeIds = [
        ...new Set(
          spins
            .map((spin) => spin.prize_id)
            .filter(Boolean)
        ),
      ];

      const couponIds = [
        ...new Set(
          spins
            .map((spin) => spin.coupon_id)
            .filter(Boolean)
        ),
      ];

      /*
       * STEP 3
       * Load prizes separately.
       */
      const { data: prizesData, error: prizesError } = await supabase
        .from("prizes")
        .select("id,name")
        .in("id", prizeIds);

      if (prizesError) {
        throw new Error(`Prizes: ${prizesError.message}`);
      }

      /*
       * STEP 4
       * Load coupons separately.
       */
      const { data: couponsData, error: couponsError } = await supabase
        .from("coupons")
        .select("id,code,status")
        .in("id", couponIds);

      if (couponsError) {
        throw new Error(`Coupons: ${couponsError.message}`);
      }

      const prizeMap = new Map<string, string>();

      (prizesData || []).forEach((prize) => {
        prizeMap.set(prize.id, prize.name);
      });

      const couponMap = new Map<
        string,
        { code: string; status: string }
      >();

      (couponsData || []).forEach((coupon) => {
        couponMap.set(coupon.id, {
          code: coupon.code,
          status: coupon.status,
        });
      });

      /*
       * STEP 5
       * Combine everything into one history list.
       */
      const combinedHistory: SpinHistory[] = spins.map((spin) => {
        const coupon = couponMap.get(spin.coupon_id);

        return {
          id: spin.id,
          mobile: spin.mobile,
          prize_id: spin.prize_id,
          coupon_id: spin.coupon_id,
          created_at: spin.created_at,
          prize_name:
            prizeMap.get(spin.prize_id) || "Prize unavailable",
          coupon_code:
            coupon?.code || "Coupon unavailable",
          coupon_status:
            coupon?.status || "unknown",
        };
      });

      setHistory(combinedHistory);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to load spin history.";

      setHistoryError(errorMessage);
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
    setError("");
  }

  async function savePrize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");

    const name = form.name.trim();
    const description = form.description.trim();
    const couponPrefix = form.coupon_prefix.trim().toUpperCase();

    const weight = Number(form.weight);
    const sortOrder = Number(form.sort_order);

    if (!name) {
      setError("Prize name is required.");
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
      setError("Sort order must be a whole number greater than 0.");
      return;
    }

    if (!couponPrefix) {
      setError("Coupon prefix is required.");
      return;
    }

    if (couponPrefix.length > 10) {
      setError("Coupon prefix must be 10 characters or less.");
      return;
    }

    setSaving(true);

    if (editingPrize) {
      const { error: updateError } = await supabase
        .from("prizes")
        .update({
          name,
          description: description || null,
          weight,
          coupon_prefix: couponPrefix,
          sort_order: sortOrder,
          active: form.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingPrize.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setMessage("Prize updated successfully.");
    } else {
      const { error: insertError } = await supabase
        .from("prizes")
        .insert({
          name,
          description: description || null,
          weight,
          coupon_prefix: couponPrefix,
          sort_order: sortOrder,
          active: form.active,
        });

      if (insertError) {
        setError(insertError.message);
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

    const { error: updateError } = await supabase
      .from("prizes")
      .update({
        active: !prize.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prize.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(
      `${prize.name} has been ${
        !prize.active ? "activated" : "deactivated"
      }.`
    );

    await loadPrizes();
  }

  async function deletePrize(prize: Prize) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${prize.name}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("prizes")
      .delete()
      .eq("id", prize.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("Prize deleted successfully.");

    await loadPrizes();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  function maskMobile(mobile: string) {
    if (!mobile) return "-";

    if (mobile.length <= 5) {
      return mobile;
    }

    return `${mobile.slice(0, 5)}****${mobile.slice(-2)}`;
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleString("en-LK", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

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

  const activeWinningWeight = prizes
    .filter((prize) => prize.active)
    .reduce(
      (total, prize) =>
        total + Number(prize.weight || 0),
      0
    );

  return (
    <main className="min-h-screen bg-slate-50">
      {checking ? (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-3 text-lg font-semibold text-slate-700">
              Checking admin access...
            </div>
            <div className="text-sm text-slate-500">
              Please wait.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* HEADER */}
          <header className="border-b bg-white shadow-sm">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Singhagiri Spin & Win
                </h1>
                <p className="text-sm text-slate-500">
                  Admin Dashboard
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-slate-600 sm:block">
                  {email}
                </span>

                <button
                  type="button"
                  onClick={logout}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          {/* CONTENT */}
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">
                Dashboard
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage Spin & Win prizes and review customer spin history.
              </p>
            </div>

            {/* GLOBAL MESSAGES */}
            {message && (
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {message}
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* STAGE 3A */}
            <section className="mb-10">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  Stage 3A — Prize Overview
                </h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Total Prizes
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {totalPrizes}
                  </p>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Active Prizes
                  </p>
                  <p className="mt-2 text-3xl font-bold text-green-600">
                    {activePrizes}
                  </p>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Inactive Prizes
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-500">
                    {inactivePrizes}
                  </p>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Active Winning Weight
                  </p>
                  <p className="mt-2 text-3xl font-bold text-blue-600">
                    {activeWinningWeight}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm leading-6 text-blue-800">
                  <strong>How winning probability works:</strong>{" "}
                  each active prize uses its weight to determine its
                  relative chance of being selected. For example, if
                  the active prizes have total weight 100 and one prize
                  has weight 20, that prize has a 20% selection
                  probability.
                </p>

                <p className="mt-2 text-xs text-blue-700">
                  Total weight across all prizes:{" "}
                  <strong>{totalWinningWeight}</strong>
                </p>
              </div>
            </section>

            {/* PRIZE MANAGEMENT */}
            <section className="mb-10">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Prize Management
                  </h3>
                  <p className="text-sm text-slate-500">
                    Add, edit, activate, deactivate, or delete prizes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openAddForm}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  + Add Prize
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                {loadingPrizes ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Loading prizes...
                  </div>
                ) : prizes.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No prizes found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                      <thead className="border-b bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Order
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Prize
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Weight
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Coupon Prefix
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status
                          </th>

                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {prizes.map((prize) => (
                          <tr key={prize.id}>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {prize.sort_order}
                            </td>

                            <td className="px-4 py-4">
                              <div className="font-medium text-slate-900">
                                {prize.name}
                              </div>

                              {prize.description && (
                                <div className="mt-1 max-w-md text-xs text-slate-500">
                                  {prize.description}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                              {prize.weight}
                            </td>

                            <td className="px-4 py-4">
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                {prize.coupon_prefix}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              {prize.active ? (
                                <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                                  Inactive
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditForm(prize)}
                                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => togglePrize(prize)}
                                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  {prize.active
                                    ? "Deactivate"
                                    : "Activate"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deletePrize(prize)}
                                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* STAGE 3B */}
            <section className="mb-10">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Stage 3B — Spin & Winner History
                  </h3>

                  <p className="text-sm text-slate-500">
                    View the latest customer spins, prizes, and coupon codes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => loadHistory(true)}
                  disabled={refreshingHistory || loadingHistory}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {refreshingHistory
                    ? "Refreshing..."
                    : "Refresh History"}
                </button>
              </div>

              {/* HISTORY SUMMARY */}
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Total Spins Loaded
                  </p>

                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {history.length}
                  </p>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Issued Coupons
                  </p>

                  <p className="mt-2 text-3xl font-bold text-green-600">
                    {
                      history.filter(
                        (item) =>
                          item.coupon_status === "issued"
                      ).length
                    }
                  </p>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Latest Spin
                  </p>

                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {history.length > 0
                      ? formatDate(history[0].created_at)
                      : "No spins"}
                  </p>
                </div>
              </div>

              {/* HISTORY ERROR */}
              {historyError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700">
                    Unable to load spin history
                  </p>

                  <p className="mt-1 break-words text-sm text-red-600">
                    {historyError}
                  </p>

                  <button
                    type="button"
                    onClick={() => loadHistory(true)}
                    className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* HISTORY TABLE */}
              <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                {loadingHistory ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Loading spin history...
                  </div>
                ) : history.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      No spin records found.
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Customer spins will appear here after they use the
                      Spin & Win wheel.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                      <thead className="border-b bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Date & Time
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Mobile
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Prize
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Coupon
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {history.map((spin) => (
                          <tr key={spin.id}>
                            <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                              {formatDate(spin.created_at)}
                            </td>

                            <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-800">
                              {maskMobile(spin.mobile)}
                            </td>

                            <td className="px-4 py-4">
                              <div className="font-medium text-slate-900">
                                {spin.prize_name}
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <span className="rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">
                                {spin.coupon_code}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              {spin.coupon_status === "issued" ? (
                                <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                                  Issued
                                </span>
                              ) : spin.coupon_status ===
                                "redeemed" ? (
                                <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                                  Redeemed
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                  {spin.coupon_status}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Showing the latest 100 spin records.
              </p>
            </section>

            {/* BACK BUTTON */}
            <div>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ← Back to Spin & Win
              </button>
            </div>
          </div>

          {/* ADD / EDIT MODAL */}
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
                <div className="border-b px-6 py-5">
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingPrize
                      ? "Edit Prize"
                      : "Add New Prize"}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Configure the prize and its winning probability.
                  </p>
                </div>

                <form
                  onSubmit={savePrize}
                  className="space-y-5 p-6"
                >
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Prize Name
                    </label>

                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          name: event.target.value,
                        })
                      }
                      placeholder="e.g. 10% OFF"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Description
                    </label>

                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          description: event.target.value,
                        })
                      }
                      placeholder="Prize description"
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                            weight: event.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      />

                      <p className="mt-1 text-xs text-slate-500">
                        Higher weight = higher chance.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Sort Order
                      </label>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={form.sort_order}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            sort_order: event.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Coupon Prefix
                    </label>

                    <input
                      type="text"
                      maxLength={10}
                      value={form.coupon_prefix}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          coupon_prefix:
                            event.target.value.toUpperCase(),
                        })
                      }
                      placeholder="e.g. SG10"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-500"
                    />

                    <p className="mt-1 text-xs text-slate-500">
                      Used when generating unique coupon codes.
                    </p>
                  </div>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          active: event.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />

                    <span className="text-sm font-medium text-slate-700">
                      Active prize
                    </span>
                  </label>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 border-t pt-5">
                    <button
                      type="button"
                      onClick={closeForm}
                      disabled={saving}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
        </>
      )}
    </main>
  );
}
