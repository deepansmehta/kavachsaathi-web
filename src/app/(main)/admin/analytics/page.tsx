"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";

/** F49 admin analytics dashboard */
export default function AdminAnalyticsPage() {
  const [data, setData] = useState<{
    daily: unknown[];
    inventory: Record<string, number>;
    csv: string;
    error?: string;
  } | null>(null);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setData({ daily: [], inventory: {}, csv: "", error: "Sign in via /admin first" });
      return;
    }
    const token = await user.getIdToken();
    const r = await fetch("/api/admin/analytics?days=30", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!r.ok) {
      setData({
        daily: [],
        inventory: {},
        csv: "",
        error: j.error || j.code || `HTTP ${r.status}`,
      });
      return;
    }
    setData(j);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadCsv = () => {
    if (!data?.csv) return;
    const blob = new Blob([data.csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kavachsaathi-analytics.csv";
    a.click();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-cream">
      <Link href="/admin" className="text-sm text-gold">
        ← Admin
      </Link>
      <h1 className="mt-4 font-rajdhani text-3xl text-gold">Analytics</h1>
      <p className="text-sm text-cream-soft">
        Aggregated counts only — no card IDs, IPs or personal data.
      </p>
      {data?.error && (
        <p className="mt-4 text-danger">{data.error}</p>
      )}
      {data && !data.error && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {Object.entries(data.inventory || {}).map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl border border-gold-border bg-kavach-s1 p-4 text-center"
              >
                <p className="font-mono text-2xl text-gold">{v}</p>
                <p className="text-xs uppercase text-cream-soft">{k}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={downloadCsv}
            className="mt-4 rounded-lg border border-gold px-4 py-2 text-gold"
          >
            Download CSV
          </button>
          <ul className="mt-6 space-y-2 text-sm">
            {(data.daily as { date: string; counts: Record<string, number> }[]).map(
              (d) => (
                <li
                  key={d.date}
                  className="rounded-lg border border-[#333] px-3 py-2"
                >
                  <strong>{d.date}</strong>{" "}
                  {Object.entries(d.counts || {})
                    .map(([t, c]) => `${t}:${c}`)
                    .join(" · ") || "—"}
                </li>
              )
            )}
          </ul>
        </>
      )}
    </main>
  );
}
