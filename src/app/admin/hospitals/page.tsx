"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import toast from "react-hot-toast";
import { Shield, Plus, LogOut, Trash2 } from "lucide-react";
import { GoldButton, GoldInput, ECGBackground } from "@/components/ui";
import { auth, initPersistentAuth } from "@/lib/firebase";

const ALLOWED = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
  "gdmtechnoworld@gmail.com,mehtadeepansh6@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

type Hospital = {
  id: string;
  name: string;
  type: string;
  city: string;
  verified: boolean;
  staffEmails: string[];
};

type FormState = {
  name: string;
  type: string;
  city: string;
  staffEmails: string;
};

export default function AdminHospitalsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [featureOn, setFeatureOn] = useState<boolean | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    type: "private",
    city: "",
    staffEmails: "",
  });

  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((d) => setFeatureOn(Boolean(d.flags?.hospitalPortal)))
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

  const isAdmin = (user?.email || "") && ALLOWED.includes((user?.email || "").toLowerCase());

  const token = useCallback(async () => {
    if (!user) return "";
    return user.getIdToken();
  }, [user]);

  const load = useCallback(async () => {
    if (!user || !isAdmin) return;
    const t = await token();
    const res = await fetch("/api/hospital/admin", {
      headers: { Authorization: `Bearer ${t}` },
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || "Load failed"); return; }
    setHospitals(data.hospitals || []);
  }, [user, isAdmin, token]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const createHospital = async () => {
    if (!form.name || !form.city) {
      toast.error("Name and city required");
      return;
    }
    setLoading(true);
    try {
      const t = await token();
      const staffEmails = form.staffEmails
        .split(/[,\n]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      const res = await fetch("/api/hospital/admin", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...form, staffEmails }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      toast.success("Hospital created");
      setForm({ name: "", type: "private", city: "", staffEmails: "" });
      void load();
    } finally {
      setLoading(false);
    }
  };

  const deleteHospital = async (id: string) => {
    if (!confirm("Delete this hospital?")) return;
    const t = await token();
    const res = await fetch("/api/hospital/admin", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (res.ok) { toast.success("Deleted"); void load(); }
    else toast.error("Delete failed");
  };

  const login = async () => {
    try {
      await initPersistentAuth();
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    }
  };

  if (checking || featureOn === null) return <Shell><p className="text-center text-[var(--text-soft)]">Loading…</p></Shell>;

  if (!user) return (
    <Shell>
      <div className="mx-auto max-w-sm rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-6 text-center">
        <Shield className="mx-auto mb-3 h-8 w-8 text-[var(--gold)]" />
        <GoldButton className="w-full mt-4" onClick={login}>Sign in with Google</GoldButton>
      </div>
    </Shell>
  );

  if (!isAdmin) return (
    <Shell>
      <div className="mx-auto max-w-sm rounded-2xl border border-red-500/30 bg-[var(--kavach-s1)] p-6 text-center">
        <p className="text-red-300">Access denied: {user.email}</p>
        <button type="button" onClick={() => signOut(auth)} className="mt-4 text-sm text-[var(--gold)]">Sign out</button>
      </div>
    </Shell>
  );

  if (!featureOn) return (
    <Shell>
      <div className="mx-auto max-w-sm rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-6 text-center">
        <p className="text-[var(--text-soft)]">hospitalPortal feature is OFF. Enable in Admin → Feature flags.</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-[var(--gold)]" />
            <h1 className="text-2xl text-white">Hospitals</h1>
          </div>
          <button type="button" onClick={() => signOut(auth)} className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
            <LogOut className="h-4 w-4" /> Out
          </button>
        </div>

        {/* Create form */}
        <div className="mb-6 space-y-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5">
          <h2 className="text-sm uppercase tracking-wider text-[var(--gold)]">Add hospital</h2>
          <GoldInput label="Hospital name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <GoldInput label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <select
              className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="private">Private</option>
              <option value="government">Government</option>
              <option value="trust">Trust / NGO</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--gold)]">Staff emails (one per line or comma-separated)</label>
            <textarea
              className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-3 py-2 text-sm text-white"
              rows={3}
              value={form.staffEmails}
              onChange={(e) => setForm({ ...form, staffEmails: e.target.value })}
              placeholder="staff@hospital.com"
            />
          </div>
          <GoldButton onClick={createHospital} disabled={loading}>
            <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Add hospital</span>
          </GoldButton>
        </div>

        {/* Hospital list */}
        <div className="overflow-x-auto rounded-2xl border border-[var(--gold-border)]">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-[var(--kavach-s2)] text-xs uppercase text-[var(--gold)]">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">City</th>
                <th className="px-3 py-3">Staff</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((h) => (
                <tr key={h.id} className="border-t border-[var(--gold-border)]/40">
                  <td className="px-3 py-2 text-white">{h.name}</td>
                  <td className="px-3 py-2 text-[var(--text-soft)]">{h.type}</td>
                  <td className="px-3 py-2 text-[var(--text-soft)]">{h.city}</td>
                  <td className="px-3 py-2 text-xs text-[var(--text-soft)]">
                    {(h.staffEmails || []).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => void deleteHospital(h.id)} className="text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!hospitals.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--text-soft)]">No hospitals yet.</td>
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
