"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { auth, initPersistentAuth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import toast from "react-hot-toast";
import { ORDER_STATUSES } from "@/lib/launchReveal";

type Order = {
  id: string;
  orderNo: string;
  pack: string;
  cards: string;
  qty: number;
  amount: number;
  name: string;
  phone: string;
  status: string;
  notes: string;
  createdAt: string | null;
};

export default function AdminOrdersPage() {
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
      const r = await fetch(`/api/admin/orders${q}`, {
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

  const patch = async (id: string, body: Record<string, string>) => {
    try {
      const t = await token();
      const r = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...body }),
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

  const exportCsv = async () => {
    try {
      const t = await token();
      const q = filter ? `&status=${encodeURIComponent(filter)}` : "";
      const r = await fetch(`/api/admin/orders?csv=1${q}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!r.ok) {
        toast.error("CSV failed");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kavach-orders.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("CSV error");
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-cream">
        <p>Sign in at <Link href="/admin" className="text-gold">/admin</Link> first.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-cream">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-gold">
            ← Admin
          </Link>
          <h1 className="mt-2 font-rajdhani text-3xl font-bold">Pack orders</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-gold/30 bg-kavach-s1 px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-gold/40 px-3 py-2 text-sm"
          >
            {loading ? "…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-kavach-black"
          >
            CSV export
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs text-cream-soft">
        CSV never includes delivery address. Decrypt address only via admin
        action when needed.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gold/20">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-kavach-s1 text-gold">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Pack</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Name / Phone</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-gold/10">
                <td className="px-3 py-2 font-mono text-xs">{o.orderNo}</td>
                <td className="px-3 py-2">
                  {o.pack}
                  <div className="text-xs text-cream-soft">{o.cards}</div>
                </td>
                <td className="px-3 py-2">{o.qty}</td>
                <td className="px-3 py-2">₹{o.amount}</td>
                <td className="px-3 py-2">
                  {o.name}
                  <div className="font-mono text-xs">{o.phone}</div>
                </td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-gold/30 bg-transparent px-2 py-1 text-xs"
                    value={o.status}
                    onChange={(e) =>
                      void patch(o.id, { status: e.target.value })
                    }
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-40 rounded border border-gold/20 bg-transparent px-2 py-1 text-xs"
                    defaultValue={o.notes}
                    onBlur={(e) => {
                      if (e.target.value !== o.notes)
                        void patch(o.id, { notes: e.target.value });
                    }}
                  />
                </td>
              </tr>
            ))}
            {!orders.length && !loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-cream-soft">
                  No orders yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
