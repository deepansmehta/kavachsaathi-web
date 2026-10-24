"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import toast from "react-hot-toast";
import { Shield, Download, LogOut } from "lucide-react";
import { GoldButton, OutlineButton, ECGBackground } from "@/components/ui";
import { auth, initPersistentAuth } from "@/lib/firebase";
import { PolicyLegalFooter } from "@/components/policy/PolicyLegalFooter";

type ClientRow = {
  firstName: string;
  lastInitial: string;
  cardIdMasked: string;
  policyType: string;
  insurerName: string;
  endDate: string | null;
  renewalStatus: "active" | "expiring_soon" | "expired" | "unknown";
};

const STATUS_LABEL: Record<ClientRow["renewalStatus"], string> = {
  active: "Active",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  unknown: "Unknown",
};

export default function AgentDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"" | "expiring_soon" | "expired">("");

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      await initPersistentAuth();
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setChecking(false);
      });
    })();
    return () => unsub();
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const t = await user.getIdToken();
      const res = await fetch("/api/agent/dashboard", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load clients");
        return;
      }
      setClients(data.clients || []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const exportCsv = async () => {
    if (!user) return;
    try {
      const t = await user.getIdToken();
      const res = await fetch("/api/agent/dashboard?format=csv", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        toast.error("Export failed");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kavachsaathi-agent-clients.csv";
      a.click();
    } catch {
      toast.error("Network error");
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const filtered = useMemo(
    () => (filter ? clients.filter((c) => c.renewalStatus === filter) : clients),
    [clients, filter]
  );

  const renewalCount = useMemo(
    () => clients.filter((c) => c.renewalStatus === "expiring_soon" || c.renewalStatus === "expired").length,
    [clients]
  );

  return (
    <main className="relative min-h-screen px-4 py-10">
      <ECGBackground />
      <div className="relative z-10 mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-[var(--gold)]" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">
                Agent Connect
              </p>
              <h1 className="text-2xl text-white">Client dashboard</h1>
            </div>
          </div>
          {user ? (
            <button type="button" onClick={logout} className="text-sm text-[var(--text-soft)]">
              <LogOut className="mr-1 inline h-4 w-4" /> Out
            </button>
          ) : null}
        </div>

        <PolicyLegalFooter />
        <p className="text-xs text-[var(--text-soft)]">
          Only first name, last initial, masked card ID, policy type, insurer,
          and renewal status are shown — never full names, numbers, or phones.
        </p>

        {checking ? (
          <p className="text-sm text-[var(--text-soft)]">Loading…</p>
        ) : !user ? (
          <div className="rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5 text-center">
            <p className="mb-3 text-sm text-[var(--text-soft)]">
              Please sign in on the agent page first.
            </p>
            <Link href="/agent">
              <GoldButton className="w-full">Go to agent sign-in</GoldButton>
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-[var(--kavach-s1)] p-5 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <Link href="/agent" className="mt-3 inline-block text-sm text-[var(--gold)]">
              Back to agent page
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--text-soft)]">
                {clients.length} client link(s) · {renewalCount} need renewal attention
              </p>
              <div className="flex gap-2">
                <OutlineButton onClick={() => void load()}>Refresh</OutlineButton>
                <GoldButton onClick={() => void exportCsv()}>
                  <Download className="mr-1 inline h-4 w-4" /> CSV
                </GoldButton>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["", "expiring_soon", "expired"] as const).map((f) => (
                <button
                  key={f || "all"}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    filter === f
                      ? "border-[var(--gold)] bg-[var(--gold-faint)] text-[var(--gold)]"
                      : "border-[var(--gold-border)] text-[var(--text-soft)]"
                  }`}
                >
                  {f === "" ? "All" : f === "expiring_soon" ? "Expiring soon" : "Expired"}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-sm text-[var(--text-soft)]">Loading clients…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-[var(--text-soft)]">No clients in this view.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-3 text-sm"
                  >
                    <div>
                      <p className="text-white">
                        {c.firstName} {c.lastInitial}. · {c.cardIdMasked}
                      </p>
                      <p className="text-xs text-[var(--text-soft)]">
                        {c.policyType} · {c.insurerName} {c.endDate ? `· ends ${c.endDate}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        c.renewalStatus === "expired"
                          ? "border-red-500/40 bg-red-500/15 text-red-300"
                          : c.renewalStatus === "expiring_soon"
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                            : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {STATUS_LABEL[c.renewalStatus]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
