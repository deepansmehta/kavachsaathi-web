"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Copy, Download } from "lucide-react";

type Panel = Record<string, unknown>;

/**
 * F58 — Hospital Scan & Register panel for verified staff.
 */
export function ScanRegisterPanel({ featureOn }: { featureOn: boolean }) {
  const [cardInput, setCardInput] = useState("");
  const [consent, setConsent] = useState<"none" | "pin" | "code">("none");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    panel: Panel;
    expiresAt: string;
    csv: string;
    tabSeparated: string;
    fhirPatient: Record<string, unknown> | null;
    accessToken: string;
  } | null>(null);

  if (!featureOn) return null;

  const register = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/hospital/scan-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardUrl: cardInput,
          consent,
          pin: consent === "pin" ? pin : undefined,
          code: consent === "code" ? code : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || `Failed (${r.status})`);
        return;
      }
      setResult({
        panel: j.panel,
        expiresAt: j.expiresAt,
        csv: j.csv,
        tabSeparated: j.tabSeparated,
        fhirPatient: j.fhirPatient,
        accessToken: j.accessToken,
      });
      toast.success(
        j.panel?.scope === "full_registration"
          ? "Full registration panel unlocked"
          : "Limited emergency data only"
      );
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const copyField = async (label: string, value: unknown) => {
    const text = Array.isArray(value)
      ? value.join("; ")
      : value == null
        ? ""
        : String(value);
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`);
  };

  const copyAll = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.tabSeparated);
    toast.success("Copied all (tab-separated)");
  };

  const download = (kind: "csv" | "json" | "fhir") => {
    if (!result) return;
    let blob: Blob;
    let name: string;
    if (kind === "csv") {
      blob = new Blob([result.csv], { type: "text/csv" });
      name = "patient-register.csv";
    } else if (kind === "fhir") {
      blob = new Blob([JSON.stringify(result.fhirPatient || result.panel, null, 2)], {
        type: "application/fhir+json",
      });
      name = "patient-fhir.json";
    } else {
      blob = new Blob([JSON.stringify(result.panel, null, 2)], {
        type: "application/json",
      });
      name = "patient-register.json";
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  };

  return (
    <div className="rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-4 space-y-3">
      <h2 className="text-sm uppercase tracking-wider text-[var(--gold)]">
        Scan &amp; Register
      </h2>
      <p className="text-xs text-[var(--text-soft)]">
        Scan a KavachSaathi card URL or enter health ID. Patient consent (PIN or
        one-time code) unlocks the full registration panel. Without consent, only
        limited emergency data is shown.
      </p>
      <input
        className="w-full rounded-lg border border-[var(--gold-border)] bg-black/40 px-3 py-2 text-sm text-white"
        placeholder="https://kavachsaathi.in/card/KVS-… or health ID"
        value={cardInput}
        onChange={(e) => setCardInput(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["none", "No consent (limited)"],
            ["pin", "Patient PIN"],
            ["code", "6-digit code"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setConsent(v)}
            className={`rounded-lg border px-3 py-1.5 ${
              consent === v
                ? "border-[var(--gold)] text-[var(--gold)]"
                : "border-[var(--gold-border)] text-[var(--text-soft)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {consent === "pin" ? (
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="Patient PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border border-[var(--gold-border)] bg-black/40 px-3 py-2 text-sm"
        />
      ) : null}
      {consent === "code" ? (
        <input
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit consent code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-lg border border-[var(--gold-border)] bg-black/40 px-3 py-2 text-sm"
        />
      ) : null}
      <button
        type="button"
        disabled={busy || !cardInput}
        onClick={() => void register()}
        className="w-full rounded-lg bg-[var(--gold)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? "Registering…" : "Register patient"}
      </button>

      {result ? (
        <div className="space-y-2 border-t border-[var(--gold-border)]/40 pt-3">
          <p className="text-xs text-[var(--text-soft)]">
            Access until {new Date(result.expiresAt).toLocaleString("en-IN")} ·{" "}
            {String(result.panel.scope)}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyAll()}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--gold)] px-2 py-1 text-xs text-[var(--gold)]"
            >
              <Copy className="h-3 w-3" /> Copy all
            </button>
            <button
              type="button"
              onClick={() => download("csv")}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--gold)] px-2 py-1 text-xs text-[var(--gold)]"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
            <button
              type="button"
              onClick={() => download("json")}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--gold)] px-2 py-1 text-xs text-[var(--gold)]"
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => download("fhir")}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--gold)] px-2 py-1 text-xs text-[var(--gold)]"
            >
              FHIR Patient
            </button>
          </div>
          {Object.entries(result.panel)
            .filter(([k]) => k !== "scope")
            .map(([k, v]) => (
              <div
                key={k}
                className="flex items-start justify-between gap-2 rounded-lg border border-[var(--gold-border)]/30 p-2 text-sm"
              >
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--gold)]">
                    {k}
                  </p>
                  <p className="text-white break-all">
                    {Array.isArray(v) ? v.join(", ") : v == null ? "—" : String(v)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Copy ${k}`}
                  onClick={() => void copyField(k, v)}
                  className="shrink-0 text-[var(--gold)]"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
