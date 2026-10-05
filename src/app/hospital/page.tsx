"use client";

import { useCallback, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import toast from "react-hot-toast";
import { Shield, LogOut } from "lucide-react";
import { GoldButton, GoldInput, ECGBackground } from "@/components/ui";
import { auth, initPersistentAuth } from "@/lib/firebase";

type HospitalInfo = {
  id: string;
  name: string;
  type: string;
  city: string;
  verified: boolean;
};

type LogRow = {
  id: string;
  mode: string;
  at: string;
};

export default function HospitalPortalPage() {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [loggedInEmail, setLoggedInEmail] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);

  // Check feature flag first
  const [featureOn, setFeatureOn] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((d) => setFeatureOn(Boolean(d.flags?.hospitalPortal)))
      .catch(() => setFeatureOn(false));
  }, []);

  const loadDashboard = useCallback(async () => {
    const res = await fetch("/api/hospital");
    if (!res.ok) return false;
    const data = await res.json();
    setHospital(data.hospital);
    setLoggedInEmail(data.email);
    setLogs(data.logs || []);
    return true;
  }, []);

  useEffect(() => {
    (async () => {
      await initPersistentAuth();
      const ok = await loadDashboard().catch(() => false);
      if (!ok) {
        setHospital(null);
      }
      setChecking(false);
    })();
  }, [loadDashboard]);

  const login = async () => {
    if (!email || !password) {
      toast.error("Email and password required");
      return;
    }
    setLoading(true);
    try {
      await initPersistentAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/hospital/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }
      await loadDashboard();
      toast.success(`Welcome, ${data.hospitalName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/hospital/login", { method: "DELETE" });
    await signOut(auth).catch(() => {});
    setHospital(null);
    setLogs([]);
    setLoggedInEmail("");
  };

  if (featureOn === false) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-6 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-[var(--gold)]" />
          <p className="text-[var(--text-soft)]">Hospital portal is not yet available.</p>
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

  if (!hospital) {
    return (
      <Shell>
        <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-[var(--gold)]" />
            <h1 className="text-xl text-white">Hospital Portal</h1>
          </div>
          <p className="text-sm text-[var(--text-soft)]">
            Sign in with your hospital staff account (email &amp; password assigned by KavachSaathi admin).
          </p>
          <GoldInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <GoldInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <GoldButton className="w-full" onClick={login} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </GoldButton>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl text-white">{hospital.name}</h1>
            <p className="text-sm text-[var(--text-soft)]">
              {hospital.type} · {hospital.city}
            </p>
            <p className="text-xs text-[var(--gold)]">{loggedInEmail}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1 rounded-lg border border-[var(--gold-border)] px-3 py-2 text-sm text-[var(--text-soft)]"
          >
            <LogOut className="h-4 w-4" /> Out
          </button>
        </div>

        <div className="rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--gold)]">
            Access history (this session)
          </h2>
          <p className="mb-3 text-xs text-[var(--text-soft)]">
            Showing your own access events only. No patient data shown here.
          </p>
          {logs.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">No events yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="rounded-lg border border-[var(--gold-border)]/40 p-2 text-sm"
                >
                  <span className="text-[var(--text-soft)]">{l.at ? new Date(l.at).toLocaleString("en-IN") : "—"}</span>
                  <span className="ml-2 text-white">{l.mode}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[var(--text-soft)]">
          Patient health data is accessible only after the patient/family enters their PIN on the KavachSaathi card page.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen px-4 py-10">
      <ECGBackground />
      <div className="relative z-10">{children}</div>
    </main>
  );
}
