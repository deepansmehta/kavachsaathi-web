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
import { Shield, LogOut, Copy } from "lucide-react";
import { GoldButton, ECGBackground } from "@/components/ui";
import { auth, initPersistentAuth } from "@/lib/firebase";

const ALLOWED = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
  "gdmtechnoworld@gmail.com,mehtadeepansh6@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

type CardRow = {
  health_id: string;
  serial: string | null;
  nfcEnabled: boolean;
};

export default function AdminNfcPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [featureOn, setFeatureOn] = useState<boolean | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((d) => setFeatureOn(Boolean(d.flags?.nfcInfo)))
      .catch(() => setFeatureOn(false));
    setBaseUrl(window.location.origin);
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

  const isAdmin = useMemo(
    () =>
      Boolean(user?.email && ALLOWED.includes((user.email || "").toLowerCase())),
    [user]
  );

  const token = useCallback(async () => {
    if (!user) return "";
    return user.getIdToken();
  }, [user]);

  const load = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    try {
      const t = await token();
      const res = await fetch("/api/admin?status=activated&limit=200", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      setCards(
        (data.cards || []).map((c: Record<string, unknown>) => ({
          health_id: c.health_id,
          serial: c.serial ?? null,
          nfcEnabled: Boolean(c.nfcEnabled),
        }))
      );
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, token]);

  useEffect(() => {
    if (isAdmin && featureOn) void load();
  }, [isAdmin, featureOn, load]);

  const toggleNfc = async (health_id: string, current: boolean) => {
    const t = await token();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-nfc", health_id, nfcEnabled: !current }),
    });
    if (res.ok) {
      setCards((prev) =>
        prev.map((c) =>
          c.health_id === health_id ? { ...c, nfcEnabled: !current } : c
        )
      );
      toast.success(!current ? "NFC enabled" : "NFC disabled");
    } else {
      const d = await res.json();
      toast.error(d.error || "Update failed");
    }
  };

  const copyUrl = (healthId: string) => {
    const url = `${baseUrl}/card/${healthId}`;
    navigator.clipboard.writeText(url).then(() => toast.success("URL copied"));
  };

  const login = async () => {
    try {
      await initPersistentAuth();
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    }
  };

  if (checking || featureOn === null)
    return <Shell><p className="text-center text-[var(--text-soft)]">Loading…</p></Shell>;

  if (!user)
    return (
      <Shell>
        <div className="mx-auto max-w-sm rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-6 text-center">
          <Shield className="mx-auto mb-3 h-8 w-8 text-[var(--gold)]" />
          <GoldButton className="mt-4 w-full" onClick={login}>Sign in with Google</GoldButton>
        </div>
      </Shell>
    );

  if (!isAdmin)
    return (
      <Shell>
        <div className="mx-auto max-w-sm rounded-2xl border border-red-500/30 bg-[var(--kavach-s1)] p-6 text-center">
          <p className="text-red-300">Access denied: {user.email}</p>
          <button type="button" onClick={() => signOut(auth)} className="mt-4 text-sm text-[var(--gold)]">Sign out</button>
        </div>
      </Shell>
    );

  if (!featureOn)
    return (
      <Shell>
        <div className="mx-auto max-w-sm rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-6 text-center">
          <p className="text-[var(--text-soft)]">nfcInfo feature is OFF. Enable in Admin → Feature flags.</p>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-[var(--gold)]" />
            <div>
              <h1 className="text-2xl text-white">NFC URL Management</h1>
              <p className="text-sm text-[var(--text-soft)]">
                Write the URL shown below to each card&apos;s NFC chip using an NFC writer app.
                See <code className="text-xs">docs/NFC-README.md</code> for instructions.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <GoldButton onClick={() => void load()} disabled={loading}>
              {loading ? "…" : "Refresh"}
            </GoldButton>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="flex items-center gap-2 rounded-lg border border-[var(--gold-border)] px-3 py-2 text-sm text-[var(--text-soft)]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--gold-border)]">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="bg-[var(--kavach-s2)] text-xs uppercase text-[var(--gold)]">
              <tr>
                <th className="px-3 py-3">Serial</th>
                <th className="px-3 py-3">Health ID</th>
                <th className="px-3 py-3">NFC URL to write</th>
                <th className="px-3 py-3">NFC enabled</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const nfcUrl = `${baseUrl}/card/${c.health_id}`;
                return (
                  <tr key={c.health_id} className="border-t border-[var(--gold-border)]/40">
                    <td className="px-3 py-2 font-mono text-[var(--text-soft)]">{c.serial ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[var(--gold-light)]">{c.health_id}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white">{nfcUrl}</span>
                        <button type="button" onClick={() => copyUrl(c.health_id)}>
                          <Copy className="h-4 w-4 text-[var(--gold)]" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void toggleNfc(c.health_id, c.nfcEnabled)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          c.nfcEnabled
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {c.nfcEnabled ? "Enabled" : "Enable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!cards.length && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[var(--text-soft)]">
                    No activated cards.
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
