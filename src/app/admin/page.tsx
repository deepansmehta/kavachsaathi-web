"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import toast from "react-hot-toast";
import { Shield, Download, RefreshCw, Search, LogOut } from "lucide-react";
import { GoldButton, OutlineButton, ECGBackground } from "@/components/ui";
import { auth, initPersistentAuth } from "@/lib/firebase";

type CardRow = {
  health_id: string;
  activation_code: string;
  status: "activated" | "unactivated" | "blocked";
  activatedAt: string | null;
  tier?: string;
  validTill?: string | null;
  isDemo?: boolean;
};

const ALLOWED =
  (process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
    "gdmtechnoworld@gmail.com,mehtadeepansh6@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<
    "" | "activated" | "unactivated" | "blocked"
  >("");
  const [loading, setLoading] = useState(false);

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

  const isAdmin = useMemo(() => {
    const email = (user?.email || "").toLowerCase();
    return Boolean(email && ALLOWED.includes(email));
  }, [user]);

  const token = useCallback(async () => {
    if (!user) return "";
    return user.getIdToken();
  }, [user]);

  const load = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    try {
      const t = await token();
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load");
        return;
      }
      setCards(data.cards || []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, q, status, token]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const login = async () => {
    try {
      await initPersistentAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    }
  };

  const logout = async () => {
    await signOut(auth);
    router.refresh();
  };

  const resetCard = async (health_id: string) => {
    if (
      !confirm(
        `Reset ${health_id}? This deactivates the card so it can be reissued.`
      )
    ) {
      return;
    }
    const t = await token();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "reset", health_id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Reset failed");
      return;
    }
    toast.success(data.message || "Reset");
    void load();
  };

  const resetPin = async (health_id: string) => {
    const new_pin = prompt(`New 4–6 digit PIN for ${health_id}`);
    if (!new_pin || !/^\d{4,6}$/.test(new_pin)) {
      toast.error("PIN must be 4–6 digits");
      return;
    }
    const t = await token();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "reset-pin", health_id, new_pin }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "PIN reset failed");
      return;
    }
    toast.success(data.message || "PIN reset");
  };

  const setValidTill = async (health_id: string, current?: string | null) => {
    const next = prompt(
      `Valid till (YYYY-MM-DD) for ${health_id}\nLeave empty to clear`,
      current || ""
    );
    if (next === null) return;
    const validTill = next.trim();
    if (validTill && !/^\d{4}-\d{2}-\d{2}$/.test(validTill)) {
      toast.error("Use YYYY-MM-DD");
      return;
    }
    const t = await token();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "set-valid-till",
        health_id,
        validTill: validTill || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Update failed");
      return;
    }
    toast.success(data.message || "Saved");
    void load();
  };

  const revealIds = async (health_id: string) => {
    if (
      !window.confirm(
        `Reveal encrypted ID numbers for ${health_id}? This is logged.`
      )
    ) {
      return;
    }
    const t = await token();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "reveal",
        health_id,
        confirm: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Reveal failed");
      return;
    }
    const lines = (data.idProofs || [])
      .map(
        (x: { type?: string; number?: string }) =>
          `${x.type}: ${x.number || "—"}`
      )
      .join("\n");
    window.alert(`Revealed (logged):\n${lines || "none"}`);
  };

  const viewDetail = async (health_id: string) => {
    const t = await token();
    const res = await fetch(
      `/api/admin?health_id=${encodeURIComponent(health_id)}`,
      { headers: { Authorization: `Bearer ${t}` } }
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Detail failed");
      return;
    }
    const p = data.profile;
    const missing = (data.missing || []).join(", ") || "none";
    const logs = (data.accessLogs || []).length;
    window.alert(
      [
        `${health_id}`,
        `complete: ${p?.profileComplete ? "yes" : "no"}`,
        `missing: ${missing}`,
        `access logs: ${logs}`,
        p?.phoneMasked ? `phone: ${p.phoneMasked}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  };

  const exportCsv = async () => {
    const t = await token();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "export" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kavachsaathi-activated.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (checking) {
    return (
      <Shell>
        <p className="text-center text-[var(--text-soft)]">Loading…</p>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-6 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-[var(--gold)]" />
          <h1 className="text-2xl">Admin · GDM Technoworld</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Sign in with an authorized team Google account.
          </p>
          <div className="mt-6">
            <GoldButton className="w-full" onClick={login}>
              Sign in with Google
            </GoldButton>
          </div>
        </div>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-[var(--kavach-s1)] p-6 text-center">
          <h1 className="text-xl text-red-300">Access denied</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            {user.email} is not on the admin allowlist.
          </p>
          <button
            type="button"
            className="mt-4 text-sm text-[var(--gold)]"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </Shell>
    );
  }

  const activated = cards.filter(
    (c) => c.status === "activated" && !c.isDemo
  ).length;
  const blocked = cards.filter(
    (c) => c.status === "blocked" && !c.isDemo
  ).length;
  const inventory = cards.filter((c) => !c.isDemo).length;
  const demoCount = cards.filter((c) => c.isDemo).length;

  return (
    <Shell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-[var(--gold)]" />
            <div>
              <h1 className="text-2xl text-white">Card inventory</h1>
              <p className="text-sm text-[var(--text-soft)]">
                {inventory} inventory · {activated} activated · {blocked}{" "}
                blocked
                {demoCount ? ` · ${demoCount} demo` : ""} · {user.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <OutlineButton onClick={() => void load()}>
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh
              </span>
            </OutlineButton>
            <GoldButton onClick={() => void exportCsv()}>
              <span className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" /> Export CSV
              </span>
            </GoldButton>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--gold-border)] px-3 py-2 text-sm text-[var(--text-soft)]"
            >
              <LogOut className="h-4 w-4" /> Out
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" />
            <input
              className="w-full rounded-lg border border-[var(--gold-border)] bg-black py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--gold)]"
              placeholder="Search health_id or activation_code"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void load()}
            />
          </div>
          <select
            className="rounded-lg border border-[var(--gold-border)] bg-black px-3 py-2 text-sm"
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as "" | "activated" | "unactivated" | "blocked"
              )
            }
          >
            <option value="">All statuses</option>
            <option value="unactivated">Unactivated</option>
            <option value="activated">Activated</option>
            <option value="blocked">Blocked</option>
          </select>
          <GoldButton onClick={() => void load()} disabled={loading}>
            {loading ? "…" : "Filter"}
          </GoldButton>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--gold-border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[var(--kavach-s2)] text-xs uppercase tracking-wider text-[var(--gold)]">
              <tr>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">health_id</th>
                <th className="px-3 py-3">activation</th>
                <th className="px-3 py-3">status</th>
                <th className="px-3 py-3">validTill</th>
                <th className="px-3 py-3">activatedAt</th>
                <th className="px-3 py-3">actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr
                  key={c.health_id || c.activation_code}
                  className="border-t border-[var(--gold-border)]/40"
                >
                  <td className="px-3 py-2 font-mono text-[var(--text-soft)]">
                    {c.activation_code}
                  </td>
                  <td className="px-3 py-2 font-mono text-[var(--gold-light)]">
                    <Link
                      href={`/card/${c.health_id}`}
                      className="hover:underline"
                    >
                      {c.health_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono">{c.activation_code}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        c.status === "activated"
                          ? "text-emerald-400"
                          : c.status === "blocked"
                            ? "text-red-300"
                            : "text-amber-300"
                      }
                    >
                      {c.status}
                      {c.isDemo ? " · DEMO" : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-soft)]">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => void setValidTill(c.health_id, c.validTill)}
                    >
                      {c.validTill || "set…"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-soft)]">
                    {c.activatedAt
                      ? new Date(c.activatedAt).toLocaleString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/card/${c.health_id}`}
                        className="text-xs text-[var(--gold)] hover:underline"
                      >
                        open QR URL
                      </Link>
                      {(c.status === "activated" || c.status === "blocked") && (
                        <>
                          <button
                            type="button"
                            className="text-xs text-[var(--gold-light)] hover:underline"
                            onClick={() => void viewDetail(c.health_id)}
                          >
                            detail
                          </button>
                          <button
                            type="button"
                            className="text-xs text-violet-300 hover:underline"
                            onClick={() => void revealIds(c.health_id)}
                          >
                            reveal IDs
                          </button>
                          <button
                            type="button"
                            className="text-xs text-amber-300 hover:underline"
                            onClick={() => void resetPin(c.health_id)}
                          >
                            reset PIN
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-300 hover:underline"
                            onClick={() => void resetCard(c.health_id)}
                          >
                            deactivate
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!cards.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-[var(--text-soft)]"
                  >
                    No cards match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen px-4 py-8">
      <ECGBackground />
      <div className="relative z-10">{children}</div>
    </main>
  );
}
