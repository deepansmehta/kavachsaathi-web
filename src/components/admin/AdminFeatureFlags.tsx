"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  type FeatureKey,
} from "@/lib/features/flags";

/** Admin feature flag toggles — Pack 3 included; defaults stay OFF until toggled. */
export function AdminFeatureFlags({ getToken }: { getToken: () => Promise<string> }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/features");
    const j = await r.json();
    setFlags(j.flags || {});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (key: FeatureKey) => {
    setSaving(true);
    try {
      const t = await getToken();
      const next = { [key]: !flags[key] };
      const r = await fetch("/api/features", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(next),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Save failed");
        return;
      }
      setFlags(j.flags || {});
      toast.success(`${FEATURE_LABELS[key]} ${j.flags?.[key] ? "ON" : "OFF"}`);
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5">
      <h2 className="font-rajdhani text-xl font-bold text-[var(--gold)]">
        Feature flags
      </h2>
      <p className="mb-4 text-xs text-[var(--text-soft)]">
        Pack 3 flags default OFF. Toggle here after launch when ready.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FEATURE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={saving}
            onClick={() => void toggle(key)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
              flags[key]
                ? "border-[var(--gold)] bg-[var(--gold-faint)] text-[var(--gold)]"
                : "border-[var(--gold-border)] text-[var(--text-soft)]"
            }`}
          >
            <span>{FEATURE_LABELS[key]}</span>
            <span className="font-mono text-xs">
              {flags[key] ? "ON" : "OFF"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
