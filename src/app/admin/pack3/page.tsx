"use client";

import { useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";

/** Pack 3 admin tools: vehicle batch (dry-run), referral conversion, feedback summary */
export default function AdminPack3Page() {
  const [log, setLog] = useState("");
  const [refCode, setRefCode] = useState("");
  const [vehicleCount, setVehicleCount] = useState(5);

  const token = async () => {
    const u = auth.currentUser;
    if (!u) throw new Error("Sign in via /admin first");
    return u.getIdToken();
  };

  const vehicleBatch = async (dryRun: boolean) => {
    try {
      const t = await token();
      const r = await fetch("/api/vehicle", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "batch",
          count: vehicleCount,
          dryRun,
        }),
      });
      const j = await r.json();
      setLog(JSON.stringify(j, null, 2));
    } catch (e) {
      setLog(e instanceof Error ? e.message : "error");
    }
  };

  const markConversion = async () => {
    try {
      const t = await token();
      const r = await fetch("/api/referral", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "conversion",
          code: refCode.trim().toUpperCase(),
        }),
      });
      const j = await r.json();
      setLog(JSON.stringify(j, null, 2));
    } catch (e) {
      setLog(e instanceof Error ? e.message : "error");
    }
  };

  const loadFeedback = async () => {
    try {
      const t = await token();
      const r = await fetch("/api/feedback?admin=1", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const j = await r.json();
      setLog(JSON.stringify(j, null, 2));
    } catch (e) {
      setLog(e instanceof Error ? e.message : "error");
    }
  };

  const loadReferrals = async () => {
    try {
      const t = await token();
      const r = await fetch("/api/referral?admin=1", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const j = await r.json();
      setLog(JSON.stringify(j, null, 2));
    } catch (e) {
      setLog(e instanceof Error ? e.message : "error");
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-cream">
      <Link href="/admin" className="text-sm text-gold">
        ← Admin
      </Link>
      <h1 className="font-rajdhani text-3xl text-gold">Pack 3 tools</h1>

      <section className="rounded-xl border border-gold-border p-4">
        <h2 className="text-lg text-gold">Vehicle batch (F50)</h2>
        <p className="text-sm text-cream-soft">
          Dry-run by default — does not create cards until you confirm.
        </p>
        <input
          type="number"
          min={1}
          max={50}
          value={vehicleCount}
          onChange={(e) => setVehicleCount(Number(e.target.value) || 5)}
          className="mt-2 w-24 rounded border border-gold-border bg-black/40 px-2 py-1"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void vehicleBatch(true)}
            className="rounded-lg border border-gold px-3 py-2 text-sm text-gold"
          >
            Dry-run
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Create REAL vehicle cards?")) void vehicleBatch(false);
            }}
            className="rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-200"
          >
            Create for real
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gold-border p-4">
        <h2 className="text-lg text-gold">Referrals (F51)</h2>
        <button
          type="button"
          onClick={() => void loadReferrals()}
          className="rounded-lg border border-gold px-3 py-2 text-sm text-gold"
        >
          Load counts
        </button>
        <div className="mt-2 flex gap-2">
          <input
            value={refCode}
            onChange={(e) => setRefCode(e.target.value)}
            placeholder="Referral code"
            className="flex-1 rounded border border-gold-border bg-black/40 px-2 py-1"
          />
          <button
            type="button"
            onClick={() => void markConversion()}
            className="rounded-lg border border-gold px-3 py-2 text-sm text-gold"
          >
            Mark converted
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gold-border p-4">
        <h2 className="text-lg text-gold">Feedback (F52)</h2>
        <button
          type="button"
          onClick={() => void loadFeedback()}
          className="rounded-lg border border-gold px-3 py-2 text-sm text-gold"
        >
          Load average + list
        </button>
      </section>

      <pre className="overflow-auto rounded-xl border border-gold-border bg-black/50 p-3 text-xs">
        {log || "Output…"}
      </pre>
    </main>
  );
}
