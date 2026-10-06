"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";

type Row = {
  health_id: string;
  serial?: string | null;
  name: string;
  phoneMasked: string;
  validTill: string;
  daysRemaining: number | null;
  whatsappUrl: string;
};

export default function AdminValidityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setError("Sign in via /admin first");
      return;
    }
    const token = await user.getIdToken();
    const r = await fetch("/api/admin/validity?expiring=30", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || j.code || `HTTP ${r.status}`);
      return;
    }
    setError("");
    setRows(j.expiring || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const extend = async (health_id: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const r = await fetch("/api/admin/validity", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "extend", health_id }),
    });
    const j = await r.json();
    if (!r.ok) {
      alert(j.error || "Extend failed");
      return;
    }
    alert(`Extended to ${j.validTill}`);
    void load();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-cream">
      <Link href="/admin" className="text-sm text-gold">
        ← Admin
      </Link>
      <h1 className="mt-4 font-rajdhani text-3xl text-gold">
        Cards expiring (30 days)
      </h1>
      {error && <p className="mt-4 text-danger">{error}</p>}
      <ul className="mt-6 space-y-3">
        {rows.map((r) => (
          <li
            key={r.health_id}
            className="rounded-xl border border-gold-border bg-kavach-s1 p-4"
          >
            <p className="font-mono text-gold">{r.health_id}</p>
            <p className="text-sm">
              {r.name || "—"} · {r.phoneMasked} · till{" "}
              {new Date(r.validTill).toLocaleDateString("en-IN")} (
              {r.daysRemaining}d)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={r.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gold px-3 py-1 text-sm text-gold"
              >
                WhatsApp
              </a>
              <button
                type="button"
                onClick={() => void extend(r.health_id)}
                className="rounded-lg border border-gold-border px-3 py-1 text-sm"
              >
                Extend +1 year
              </button>
            </div>
          </li>
        ))}
        {!rows.length && !error && (
          <p className="text-sm text-cream-soft">No cards in window.</p>
        )}
      </ul>
    </main>
  );
}
