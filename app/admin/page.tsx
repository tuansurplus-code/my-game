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

    loadPrizes();
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
    const couponPrefix = form.coupon_prefix.trim().toUpperCase();

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

    if (!Number.isInteger(sortOrder) || sortOrder < 1) {
      setError("Display order must be a whole number starting from 1.");
      return;
    }

    if (!couponPrefix) {
      setError("Please enter a coupon prefix.");
      return;
    }

    if (couponPrefix.length > 10) {
      setError("Coupon prefix must be 10 characters or less.");
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
        setError(error.message || "Unable to update prize.");
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
        setError(error.message || "Unable to add prize.");
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
      setError(error.message || "Unable to change prize status.");
      return;
    }

    setMessage(
      `${prize.name} is now ${!prize.active ? "active" : "inactive"}.`
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
      setError(error.message || "Unable to delete prize.");
      setDeleting(null);
      return;
    }

    setMessage(`${prize.name} has been deleted.`);
    setDeleting(null);

    await loadPrizes();
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
          <div className="header-mark">S</div>

          <div>
            <div className="header-name">SINGHAGIRI</div>

            <div className="header-subtitle">
              SPIN & WIN ADMIN
            </div>
          </div>
        </div>

        <div className="header-right">
          <span className="admin-email">{email}</span>

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

            <h1>Spin & Win Dashboard</h1>

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

        <div className="section-header">
          <div>
            <h2>Prize Management</h2>

            <p>
              Control prizes, winning weights and coupon settings.
            </p>
          </div>

          <div className="prize-count">
            {prizes.length} prize{prizes.length !== 1 ? "s" : ""}
          </div>
        </div>

        {loadingPrizes ? (
          <div className="loading-box">
            Loading prizes...
          </div>
        ) : prizes.length === 0 ? (
          <div className="empty-box">
            <div className="empty-icon">🎁</div>

            <h3>No prizes found</h3>

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
                          onClick={() => togglePrize(prize)}
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
                            disabled={deleting === prize.id}
                            onClick={() =>
                              deletePrize(prize)
                            }
                          >
                            {deleting === prize.id
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

        <button
          className="back-button"
          onClick={() => router.push("/")}
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
                <label>PRIZE NAME</label>

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
                <label>DESCRIPTION</label>

                <textarea
                  value={form.description}
                  placeholder="Optional prize description"
                  rows={3}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                  disabled={saving}
                />
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>WINNING WEIGHT</label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.weight}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weight: e.target.value,
                      })
                    }
                    disabled={saving}
                  />

                  <small>
                    Higher weight = higher chance.
                  </small>
                </div>

                <div className="form-field">
                  <label>DISPLAY ORDER</label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sort_order: e.target.value,
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
                <label>COUPON PREFIX</label>

                <input
                  type="text"
                  maxLength={10}
                  value={form.coupon_prefix}
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
                  <strong>Prize Status</strong>

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
                      active: !form.active,
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

        /* MODAL */

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
        }
      `}</style>
    </main>
  );
}
