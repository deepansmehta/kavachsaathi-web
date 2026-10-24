"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import toast from "react-hot-toast";
import { Shield, LogOut } from "lucide-react";
import { GoldButton, GoldInput, ECGBackground } from "@/components/ui";
import { auth, initPersistentAuth } from "@/lib/firebase";
import { PolicyLegalFooter } from "@/components/policy/PolicyLegalFooter";

type AgentRecord = {
  agentCode: string;
  name: string;
  phone: string;
  company: string;
  agencyCode: string | null;
  city: string;
  status: "pending" | "approved";
};

export default function AgentPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [featureOn, setFeatureOn] = useState<boolean | null>(null);
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [notRegistered, setNotRegistered] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [agencyCode, setAgencyCode] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((d) => setFeatureOn(Boolean(d.flags?.agentConnect)))
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

  const loadAgent = useCallback(async () => {
    if (!user) return;
    try {
      const t = await user.getIdToken();
      const res = await fetch("/api/agent/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 404) {
        setNotRegistered(true);
        setAgent(null);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setAgent(data.agent);
        setNotRegistered(false);
      }
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    if (user) void loadAgent();
  }, [user, loadAgent]);

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
    setAgent(null);
    setNotRegistered(false);
  };

  const register = async () => {
    if (!name.trim() || !phone.trim() || !company.trim() || !city.trim()) {
      toast.error("Name, phone, company and city are required");
      return;
    }
    setLoading(true);
    try {
      const t = await user!.getIdToken();
      const res = await fetch("/api/agent/register", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          company: company.trim(),
          agencyCode: agencyCode.trim() || undefined,
          city: city.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }
      toast.success("Registered — pending admin approval");
      setAgent(data.agent);
      setNotRegistered(false);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen px-4 py-10">
      <ECGBackground />
      <div className="relative z-10 mx-auto max-w-md space-y-5">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-[var(--gold)]" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">
              Agent Connect
            </p>
            <h1 className="text-2xl text-white">Insurance agent sign-in</h1>
          </div>
        </div>

        <PolicyLegalFooter />

        {featureOn === false ? (
          <p className="rounded-xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-4 text-sm text-[var(--text-soft)]">
            Agent Connect is not available right now.
          </p>
        ) : checking ? (
          <p className="text-sm text-[var(--text-soft)]">Loading…</p>
        ) : !user ? (
          <div className="rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5 text-center">
            <p className="mb-4 text-sm text-[var(--text-soft)]">
              Sign in with your Google account to register as a KavachSaathi
              agent.
            </p>
            <GoldButton className="w-full" onClick={login}>
              Sign in with Google
            </GoldButton>
          </div>
        ) : notRegistered ? (
          <div className="space-y-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5">
            <h2 className="text-sm uppercase tracking-wider text-[var(--gold)]">
              Agent registration / एजेंट पंजीकरण
            </h2>
            <GoldInput label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <GoldInput
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
            />
            <GoldInput label="Company / agency" value={company} onChange={(e) => setCompany(e.target.value)} />
            <GoldInput
              label="Agency code (optional)"
              value={agencyCode}
              onChange={(e) => setAgencyCode(e.target.value)}
            />
            <GoldInput label="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <GoldButton className="w-full" disabled={loading} onClick={() => void register()}>
              {loading ? "Submitting…" : "Register"}
            </GoldButton>
            <button type="button" onClick={logout} className="w-full text-sm text-[var(--text-soft)]">
              <LogOut className="mr-1 inline h-4 w-4" /> Sign out
            </button>
          </div>
        ) : agent ? (
          <div className="space-y-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5">
            <p className="font-mono text-sm text-[var(--gold)]">{agent.agentCode}</p>
            <p className="text-white">{agent.name} · {agent.company}</p>
            <p className="text-sm text-[var(--text-soft)]">{agent.city}</p>
            <span
              className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase ${
                agent.status === "approved"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/15 text-amber-200"
              }`}
            >
              {agent.status === "approved" ? "Approved / स्वीकृत" : "Pending approval / समीक्षाधीन"}
            </span>
            {agent.status === "approved" ? (
              <Link href="/agent/dashboard" className="block">
                <GoldButton className="w-full">Open agent dashboard</GoldButton>
              </Link>
            ) : (
              <p className="text-xs text-[var(--text-soft)]">
                An admin will review your registration shortly.
              </p>
            )}
            <button type="button" onClick={logout} className="w-full text-sm text-[var(--text-soft)]">
              <LogOut className="mr-1 inline h-4 w-4" /> Sign out
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-soft)]">Loading agent profile…</p>
        )}
      </div>
    </main>
  );
}
