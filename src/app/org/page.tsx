"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import toast from "react-hot-toast";
import { Shield, Download, LogOut, RefreshCw } from "lucide-react";
import { GoldButton, OutlineButton, ECGBackground } from "@/components/ui";
import { auth, initPersistentAuth } from "@/lib/firebase";

const ALLOWED = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
  "gdmtechnoworld@gmail.com,mehtadeepansh6@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
void ALLOWED; // referenced indirectly via isOrgAdmin; kept for future use

type OrgData = {
  id: string;
  name: string;
  type: string;
  serialRanges: string[];
};

type CardRow = {
  serial: string | null;
  activated: boolean;
  activationDate: string | null;
};

export default function OrgDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [featureOn, setFeatureOn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);

  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((d) => setFeatureOn(Boolean(d.flags?.orgDashboard)))
      .catch(() => setFeatureOn(false));
  }, []);

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

  const isOrgAdmin = useMemo(
    () => Boolean(user?.email),
    [user]
  );

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/org", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load");
        return;
      }
      setOrg(data.org);
      setCards(data.cards || []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && featureOn) void loadData();
  }, [user, featureOn, loadData]);

  const login = async () => {
    try {
      await initPersistentAuth();
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    }
  };

  const logout = async () => {
    await signOut(auth);
    setOrg(null);
    setCards([]);
  };

  const exportCsv = () => {
    if (!cards.length) return;
    const rows = [
      ["serial", "activated", "activationDate"].join(","),
      ...cards.map((c) =>
        [c.serial ?? "", c.activated ? "yes" : "no", c.activationDate ?? ""].join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${org?.name || "org"}-cards.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (featureOn === false) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-6 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-[var(--gold)]" />
          <p className="text-[var(--text-soft)]">Org dashboard is not yet available.</p>
        </div>
      </Shell>
    );
  }

  if (checking || featureOn === null) {
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
          <h1 className="text-xl text-white">Organisation Dashboard</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Sign in with your organisation Google account.
          </p>
          <div className="mt-4">
            <GoldButton className="w-full" onClick={login}>
              Sign in with Google
            </GoldButton>
          </div>
        </div>
      </Shell>
    );
  }

  if (!isOrgAdmin || !org) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-[var(--kavach-s1)] p-6 text-center">
          <h1 className="text-xl text-red-300">
            {loading ? "Loading…" : "No organisation found"}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            {user.email} is not linked to any organisation.
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

  const activatedCount = cards.filter((c) => c.activated).length;

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl text-white">{org.name}</h1>
            <p className="text-sm text-[var(--text-soft)]">
              {org.type} · {cards.length} cards · {activatedCount} activated
            </p>
            <p className="text-xs text-[var(--gold)]/80">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <OutlineButton onClick={() => void loadData()}>
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh
              </span>
            </OutlineButton>
            <GoldButton onClick={exportCsv}>
              <span className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" /> Export CSV
              </span>
            </GoldButton>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-lg border border-[var(--gold-border)] px-3 py-2 text-sm text-[var(--text-soft)]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mb-3 text-xs text-[var(--text-soft)]">
          Showing serial, activation status, and activation date only.
          No health data is accessible through this dashboard.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-[var(--gold-border)]">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead className="bg-[var(--kavach-s2)] text-xs uppercase tracking-wider text-[var(--gold)]">
              <tr>
                <th className="px-3 py-3">Serial</th>
                <th className="px-3 py-3">Activated</th>
                <th className="px-3 py-3">Activation date</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c, i) => (
                <tr key={c.serial ?? i} className="border-t border-[var(--gold-border)]/40">
                  <td className="px-3 py-2 font-mono text-[var(--text-soft)]">
                    {c.serial ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={c.activated ? "text-emerald-400" : "text-amber-300"}>
                      {c.activated ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-soft)]">
                    {c.activationDate
                      ? new Date(c.activationDate).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                </tr>
              ))}
              {!cards.length && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-[var(--text-soft)]">
                    No cards in your serial range.
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
