"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { auth, initPersistentAuth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import toast from "react-hot-toast";

type Order = {
  id: string;
  health_id: string;
  vehicleNumber: string;
  vehicleType: string;
  qty: number;
  phone: string;
  status: string;
  adminNote: string;
  address: string;
  createdAt: string;
};

const STATUSES = [
  "requested",
  "confirmed",
  "printed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export default function AdminStickerOrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    void initPersistentAuth().then(() => {
      unsub = onAuthStateChanged(auth, setUser);
    });
    return () => unsub();
  }, []);

  const token = async () => {
    const u = auth.currentUser;
    if (!u) throw new Error("Sign in at /admin first");
    return u.getIdToken();
  };

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const t = await token();
      const q = filter ? `?status=${encodeURIComponent(filter)}` : "";
      const r = await fetch(`/api/admin/sticker-orders${q}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Load failed");
        return;
      }
      setOrders(j.orders || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (orderId: string, patchBody: Record<string, string>) => {
    try {
      const t = await token();
      const r = await fetch("/api/admin/sticker-orders", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, ...patchBody }),
      });
      if (!r.ok) {
        const j = await r.json();
        toast.error(j.error || "Update failed");
        return;
      }
      toast.success("Updated");
      void load();
    } catch {
      toast.error("Network error");
    }
  };

  const downloadPrint = async (order: Order) => {
    try {
      const t = await token();
      const r = await fetch(
        `/api/admin/sticker-orders/${encodeURIComponent(order.id)}/print`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.error || `Print blocked (${r.status})`);
        return;
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sticker-${order.health_id}.png`;
      a.click();
    } catch {
      toast.error("Download failed");
    }
  };

  const exportCsv = async () => {
    try {
      const t = await token();
      const r = await fetch("/api/admin/sticker-orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "exportCsv" }),
      });
      if (!r.ok) {
        toast.error("CSV export failed");
        return;
      }
      const text = await r.text();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
      a.download = "sticker-orders.csv";
      a.click();
    } catch {
      toast.error("Export failed");
    }
  };

  const printable = (status: string) =>
    ["confirmed", "printed", "shipped", "delivered"].includes(status);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 text-cream">
      <Link href="/admin" className="text-sm text-gold">
        ← Admin
      </Link>
      <h1 className="font-rajdhani text-3xl text-gold">Car sticker orders</h1>

      <div className="flex flex-wrap gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-gold-border bg-black/40 px-2 py-1 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-gold px-3 py-1 text-sm text-gold"
        >
          {loading ? "…" : "Refresh"}
        </button>
        <button
          type="button"
          onClick={() => void exportCsv()}
          className="rounded border border-gold px-3 py-1 text-sm text-gold"
        >
          Export CSV (no address)
        </button>
      </div>

      <div className="space-y-4">
        {orders.map((o) => (
          <div
            key={o.id}
            className="rounded-xl border border-gold-border p-4 text-sm"
          >
            <p className="font-mono text-gold">{o.health_id}</p>
            <p>
              {o.vehicleNumber} · {o.vehicleType} · qty {o.qty} · {o.phone}
            </p>
            <p className="text-cream-soft text-xs">{o.address}</p>
            <p className="mt-1">
              Status:{" "}
              <select
                value={o.status}
                onChange={(e) =>
                  void patch(o.id, { status: e.target.value })
                }
                className="rounded border border-gold-border bg-black/40 px-1"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </p>
            <label className="mt-2 block text-xs text-cream-soft">
              Admin note
              <input
                defaultValue={o.adminNote}
                onBlur={(e) => {
                  if (e.target.value !== o.adminNote) {
                    void patch(o.id, { adminNote: e.target.value });
                  }
                }}
                className="mt-1 w-full rounded border border-gold-border bg-black/40 px-2 py-1"
              />
            </label>
            <button
              type="button"
              disabled={!printable(o.status)}
              onClick={() => void downloadPrint(o)}
              className="mt-3 rounded border border-gold px-3 py-1 text-gold disabled:opacity-40"
            >
              Download print file
            </button>
            <p className="mt-1 text-[10px] text-cream-soft">
              Created {o.createdAt?.slice(0, 19)}
            </p>
          </div>
        ))}
        {!loading && orders.length === 0 ? (
          <p className="text-cream-soft">No orders.</p>
        ) : null}
      </div>
    </main>
  );
}
