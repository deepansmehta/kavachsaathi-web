"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { GoldButton, OutlineButton, GoldInput } from "@/components/ui";
import { compressImageFile } from "@/lib/clientUpload";
import {
  POLICY_TYPES,
  MAX_POLICIES,
  MAX_DOCS_PER_POLICY,
  MAX_CLAIMS_PER_POLICY,
  CLAIM_TYPES,
  CLAIM_STATUSES,
  type PolicyType,
  type PolicyRecord,
  type PolicyClaim,
  type ClaimType,
  type ClaimStatus,
  type DocKind,
} from "@/lib/policy/types";
import {
  POLICY_TYPE_LABELS,
  CLAIM_TYPE_LABELS,
  CLAIM_STATUS_LABELS,
  INSURER_NAME_SUGGESTIONS,
} from "@/lib/policy/constants";
import { formatPolicyDateDMY, type PolicyStatus } from "@/lib/policy/status";
import { buildInformInsurerMessage } from "@/lib/policy/informMessage";
import type { ChecklistItem } from "@/lib/policy/checklists";
import type { WorkDetailsEdit } from "@/lib/workDetails";
import { enablePolicyPush } from "@/lib/policy/fcmClient";
import { PolicyLegalFooter } from "./PolicyLegalFooter";
import { PolicyStatusChip } from "./PolicyStatusChip";
import { InformInsurerSheet } from "./InformInsurerSheet";

type ApiPolicy = PolicyRecord & { status: PolicyStatus };
type ApiClaim = PolicyClaim & { checklist: ChecklistItem[] };
type Flags = Record<string, boolean>;

type FormState = {
  type: PolicyType | "";
  insurerName: string;
  policyNumber: string;
  memberId: string;
  tpaName: string;
  cashlessHelpline: string;
  claimHelpline: string;
  sumInsured: string;
  roomRentLimit: string;
  coPayPercent: string;
  waitingPeriodNote: string;
  startDate: string;
  endDate: string;
  isFamilyFloater: boolean;
  showOnEmergencyScan: boolean;
  nomineeName: string;
  nomineeRelation: string;
  nomineePhone: string;
};

function emptyForm(): FormState {
  return {
    type: "",
    insurerName: "",
    policyNumber: "",
    memberId: "",
    tpaName: "",
    cashlessHelpline: "",
    claimHelpline: "",
    sumInsured: "",
    roomRentLimit: "",
    coPayPercent: "",
    waitingPeriodNote: "",
    startDate: "",
    endDate: "",
    isFamilyFloater: false,
    showOnEmergencyScan: true,
    nomineeName: "",
    nomineeRelation: "",
    nomineePhone: "",
  };
}

function formFromPolicy(p: ApiPolicy): FormState {
  return {
    type: p.type,
    insurerName: p.insurerName || "",
    policyNumber: p.policyNumber || "",
    memberId: p.memberId || "",
    tpaName: p.tpaName || "",
    cashlessHelpline: p.cashlessHelpline || "",
    claimHelpline: p.claimHelpline || "",
    sumInsured: p.sumInsured || "",
    roomRentLimit: p.roomRentLimit || "",
    coPayPercent: p.coPayPercent || "",
    waitingPeriodNote: p.waitingPeriodNote || "",
    startDate: p.startDate || "",
    endDate: p.endDate || "",
    isFamilyFloater: !!p.isFamilyFloater,
    showOnEmergencyScan: p.showOnEmergencyScan !== false,
    nomineeName: p.nominee?.name || "",
    nomineeRelation: p.nominee?.relation || "",
    nomineePhone: p.nominee?.phone || "",
  };
}

function isGroupViaEmployer(p: ApiPolicy, workDetails?: WorkDetailsEdit | null): boolean {
  if (!workDetails?.organisationName) return false;
  const groupish: PolicyType[] = ["health", "personal_accident", "term"];
  if (!groupish.includes(p.type)) return false;
  if (p.isFamilyFloater) return true;
  const company = (workDetails.companyInsurer || "").trim().toLowerCase();
  return !!company && company === (p.insurerName || "").trim().toLowerCase();
}

async function uploadPolicyDoc(opts: {
  policyId: string;
  kind: DocKind;
  file: File;
  claimId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  let blob: Blob = opts.file;
  let contentType = opts.file.type || "application/octet-stream";
  const fileName = opts.file.name || "document";

  if (contentType.startsWith("image/")) {
    const compressed = await compressImageFile(opts.file);
    blob = compressed.blob;
    contentType = compressed.contentType;
  } else if (contentType !== "application/pdf") {
    return { ok: false, error: "Only JPEG, PNG, or PDF allowed" };
  }

  const signRes = await fetch("/api/policies/upload/signed-put", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      policyId: opts.policyId,
      kind: opts.kind,
      contentType,
      claimId: opts.claimId || undefined,
    }),
  });
  const signData = await signRes.json();
  if (!signRes.ok) return { ok: false, error: signData.error || "Upload init failed" };

  const put = await fetch(signData.url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!put.ok) return { ok: false, error: "Upload failed" };

  const confirmRes = await fetch("/api/policies/upload/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      policyId: opts.policyId,
      path: signData.path,
      contentType,
      kind: opts.kind,
      fileName,
      claimId: opts.claimId || undefined,
    }),
  });
  const confirmData = await confirmRes.json();
  if (!confirmRes.ok) return { ok: false, error: confirmData.error || "Confirm failed" };
  return { ok: true };
}

/**
 * Policy Wallet — main UI for /my-profile "Policies" section.
 * All sub-features are individually gated by their own feature flag.
 */
export function PolicyWallet({
  healthId,
  holderName,
  flags,
  workDetails,
}: {
  healthId: string;
  holderName?: string;
  flags: Flags;
  workDetails?: WorkDetailsEdit | null;
}) {
  const [policies, setPolicies] = useState<ApiPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [insurers, setInsurers] = useState<{ name: string; website: string }[] | null>(null);

  const [reminderPrefs, setReminderPrefs] = useState<{
    push: boolean;
    calendarExported: boolean;
  }>({ push: false, calendarExported: false });
  const [pushBusy, setPushBusy] = useState(false);

  const [claimsByPolicy, setClaimsByPolicy] = useState<Record<string, ApiClaim[]>>({});
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});
  const [newClaim, setNewClaim] = useState<Record<string, { claimType: ClaimType | ""; hospital: string; admissionDate: string }>>({});

  const [floaterOpen, setFloaterOpen] = useState<Record<string, boolean>>({});
  const [floaterMembers, setFloaterMembers] = useState<Record<string, string[]>>({});
  const [floaterInput, setFloaterInput] = useState<Record<string, string>>({});

  const [agentPinOpen, setAgentPinOpen] = useState<Record<string, boolean>>({});
  const [agentCodeInput, setAgentCodeInput] = useState<Record<string, string>>({});
  const [agentPinInput, setAgentPinInput] = useState<Record<string, string>>({});

  const [cashlessPinOpen, setCashlessPinOpen] = useState<Record<string, boolean>>({});
  const [cashlessPinInput, setCashlessPinInput] = useState<Record<string, string>>({});
  const [cashlessBusy, setCashlessBusy] = useState<string | null>(null);

  const [informFor, setInformFor] = useState<ApiPolicy | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/policies");
      if (!res.ok) {
        setPolicies([]);
        return;
      }
      const data = await res.json();
      setPolicies(data.policies || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!flags.policyReminders) return;
    fetch("/api/policies/reminders")
      .then((r) => r.json())
      .then((d) => {
        if (d.reminderPrefs) {
          setReminderPrefs({
            push: !!d.reminderPrefs.push,
            calendarExported: !!d.reminderPrefs.calendarExported,
          });
        }
      })
      .catch(() => {});
  }, [flags.policyReminders]);

  const loadInsurers = useCallback(async () => {
    if (insurers !== null || !flags.insurerLinks) return insurers;
    try {
      const res = await fetch("/api/policies/insurers");
      const data = await res.json();
      const list = Array.isArray(data.insurers) ? data.insurers : [];
      setInsurers(list);
      return list as { name: string; website: string }[];
    } catch {
      setInsurers([]);
      return [];
    }
  }, [insurers, flags.insurerLinks]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const beginAdd = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  };

  const beginEdit = (p: ApiPolicy) => {
    setForm(formFromPolicy(p));
    setEditingId(p.id);
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.type) {
      toast.error("Select a policy type / प्रकार चुनें");
      return;
    }
    if (!form.insurerName.trim()) {
      toast.error("Insurer name required / बीमाकर्ता का नाम आवश्यक है");
      return;
    }
    if (!editingId && policies.length >= MAX_POLICIES) {
      toast.error(`Maximum ${MAX_POLICIES} policies allowed`);
      return;
    }
    setSaving(true);
    try {
      const nominee =
        form.nomineeName.trim() || form.nomineeRelation.trim() || form.nomineePhone.trim()
          ? {
              name: form.nomineeName.trim(),
              relation: form.nomineeRelation.trim(),
              phone: form.nomineePhone.trim(),
            }
          : null;
      const body: Record<string, unknown> = {
        type: form.type,
        insurerName: form.insurerName.trim(),
        policyNumber: form.policyNumber.trim() || null,
        memberId: form.memberId.trim() || null,
        tpaName: form.tpaName.trim() || null,
        cashlessHelpline: form.cashlessHelpline.trim() || null,
        claimHelpline: form.claimHelpline.trim() || null,
        sumInsured: form.sumInsured.trim() || null,
        roomRentLimit: form.roomRentLimit.trim() || null,
        coPayPercent: form.coPayPercent.trim() || null,
        waitingPeriodNote: form.waitingPeriodNote.trim() || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        isFamilyFloater: form.isFamilyFloater,
        showOnEmergencyScan: form.showOnEmergencyScan,
        nominee,
      };
      const res = editingId
        ? await fetch("/api/policies", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, policyId: editingId }),
          })
        : await fetch("/api/policies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      toast.success("✅ Saved / सेव हो गया");
      resetForm();
      await load();
    } catch {
      toast.error("Network error / नेटवर्क त्रुटि");
    } finally {
      setSaving(false);
    }
  };

  const deletePolicy = async (id: string) => {
    if (!confirm("Delete this policy? / यह पॉलिसी हटाएँ?")) return;
    try {
      const res = await fetch(`/api/policies?policyId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Delete failed");
        return;
      }
      toast.success("Policy deleted / पॉलिसी हटाई गई");
      await load();
    } catch {
      toast.error("Network error");
    }
  };

  const toggleEmergencyScan = async (p: ApiPolicy) => {
    try {
      const res = await fetch("/api/policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: p.id,
          showOnEmergencyScan: !p.showOnEmergencyScan,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Update failed");
        return;
      }
      await load();
    } catch {
      toast.error("Network error");
    }
  };

  const onUploadDoc = async (p: ApiPolicy, file: File) => {
    if (p.documents.length >= MAX_DOCS_PER_POLICY) {
      toast.error(`Maximum ${MAX_DOCS_PER_POLICY} documents allowed per policy`);
      return;
    }
    const kind: DocKind = p.type === "health" ? "card" : "policy_copy";
    const result = await uploadPolicyDoc({ policyId: p.id, kind, file });
    if (!result.ok) {
      toast.error(result.error || "Upload failed");
      return;
    }
    toast.success("Document uploaded");
    await load();
  };

  const viewDoc = async (p: ApiPolicy, path: string) => {
    try {
      const res = await fetch(
        `/api/policies/document?policyId=${encodeURIComponent(p.id)}&path=${encodeURIComponent(path)}`
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not open document");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Network error");
    }
  };

  const downloadIcs = (p: ApiPolicy) => {
    if (!p.endDate) {
      toast.error("No end date set for this policy");
      return;
    }
    const a = document.createElement("a");
    a.href = `/api/policies/ics?policyId=${encodeURIComponent(p.id)}`;
    a.click();
  };

  const downloadCashlessPdf = async (p: ApiPolicy) => {
    const pin = cashlessPinInput[p.id] || "";
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("Enter your 4–6 digit PIN");
      return;
    }
    setCashlessBusy(p.id);
    try {
      const res = await fetch("/api/policies/cashless-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: p.id, pin }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Download failed");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cashless-info-sheet.pdf";
      a.click();
      setCashlessPinOpen((s) => ({ ...s, [p.id]: false }));
      setCashlessPinInput((s) => ({ ...s, [p.id]: "" }));
    } catch {
      toast.error("Network error");
    } finally {
      setCashlessBusy(null);
    }
  };

  const openInsurerWebsite = async (p: ApiPolicy) => {
    const list = await loadInsurers();
    const site = (list || []).find((i) =>
      i.name.toLowerCase().includes(p.insurerName.trim().toLowerCase())
    )?.website;
    if (!site) {
      toast.error("Official website not listed for this insurer");
      return;
    }
    window.open(site, "_blank", "noopener,noreferrer");
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (reminderPrefs.push) {
        const res = await fetch("/api/policies/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ push: false }),
        });
        if (res.ok) {
          setReminderPrefs((s) => ({ ...s, push: false }));
          toast.success("Push reminders turned off");
        }
        return;
      }
      const result = await enablePolicyPush();
      if (!result.enabled) {
        // Unsupported / permission denied — skip silently per spec, no error toast.
        return;
      }
      setReminderPrefs((s) => ({ ...s, push: true }));
      toast.success("Push reminders enabled");
    } finally {
      setPushBusy(false);
    }
  };

  const loadClaims = async (policyId: string) => {
    try {
      const res = await fetch(`/api/policies/claims?policyId=${encodeURIComponent(policyId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setClaimsByPolicy((s) => ({ ...s, [policyId]: data.claims || [] }));
    } catch {
      /* ignore */
    }
  };

  const toggleClaims = async (policyId: string) => {
    const next = !expandedClaims[policyId];
    setExpandedClaims((s) => ({ ...s, [policyId]: next }));
    if (next && !claimsByPolicy[policyId]) {
      await loadClaims(policyId);
    }
  };

  const startClaim = async (policyId: string) => {
    const nc = newClaim[policyId];
    if (!nc?.claimType) {
      toast.error("Select claim type / दावा प्रकार चुनें");
      return;
    }
    const existing = claimsByPolicy[policyId] || [];
    if (existing.length >= MAX_CLAIMS_PER_POLICY) {
      toast.error(`Maximum ${MAX_CLAIMS_PER_POLICY} claims allowed per policy`);
      return;
    }
    try {
      const res = await fetch("/api/policies/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId,
          claimType: nc.claimType,
          hospital: nc.hospital,
          admissionDate: nc.admissionDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to start claim");
        return;
      }
      toast.success("Claim started / दावा शुरू हुआ");
      setNewClaim((s) => ({ ...s, [policyId]: { claimType: "", hospital: "", admissionDate: "" } }));
      await loadClaims(policyId);
    } catch {
      toast.error("Network error");
    }
  };

  const updateClaimStatus = async (policyId: string, claimId: string, status: ClaimStatus) => {
    try {
      const res = await fetch("/api/policies/claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, claimId, status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Update failed");
        return;
      }
      await loadClaims(policyId);
    } catch {
      toast.error("Network error");
    }
  };

  const toggleChecklistTick = async (policyId: string, claim: ApiClaim, itemId: string) => {
    const nextTicks = { ...claim.checklistTicks, [itemId]: !claim.checklistTicks[itemId] };
    try {
      await fetch("/api/policies/claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, claimId: claim.id, checklistTicks: nextTicks }),
      });
      await loadClaims(policyId);
    } catch {
      toast.error("Network error");
    }
  };

  const deleteClaim = async (policyId: string, claimId: string) => {
    if (!confirm("Delete this claim?")) return;
    try {
      await fetch(
        `/api/policies/claims?policyId=${encodeURIComponent(policyId)}&claimId=${encodeURIComponent(claimId)}`,
        { method: "DELETE" }
      );
      await loadClaims(policyId);
    } catch {
      toast.error("Network error");
    }
  };

  const toggleFloater = async (p: ApiPolicy) => {
    const next = !floaterOpen[p.id];
    setFloaterOpen((s) => ({ ...s, [p.id]: next }));
    if (next && !floaterMembers[p.id]) {
      try {
        const res = await fetch(`/api/policies/floater?policyId=${encodeURIComponent(p.id)}`);
        const data = await res.json();
        setFloaterMembers((s) => ({ ...s, [p.id]: data.coveredMembers || [] }));
      } catch {
        /* ignore */
      }
    }
  };

  const linkFloaterMember = async (p: ApiPolicy) => {
    const id = (floaterInput[p.id] || "").trim().toUpperCase();
    if (!id) return;
    try {
      const res = await fetch("/api/policies/floater", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: p.id, memberHealthIds: [id] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to link member");
        return;
      }
      toast.success("Member linked");
      setFloaterInput((s) => ({ ...s, [p.id]: "" }));
      setFloaterMembers((s) => ({ ...s, [p.id]: data.coveredMembers || [] }));
      await load();
    } catch {
      toast.error("Network error");
    }
  };

  const unlinkFloaterMember = async (p: ApiPolicy, memberId: string) => {
    try {
      await fetch(
        `/api/policies/floater?policyId=${encodeURIComponent(p.id)}&healthId=${encodeURIComponent(memberId)}`,
        { method: "DELETE" }
      );
      setFloaterMembers((s) => ({ ...s, [p.id]: (s[p.id] || []).filter((m) => m !== memberId) }));
    } catch {
      toast.error("Network error");
    }
  };

  const linkAgent = async (p: ApiPolicy) => {
    const pin = agentPinInput[p.id] || "";
    const code = (agentCodeInput[p.id] || "").trim().toUpperCase();
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("Enter your PIN");
      return;
    }
    if (!code) {
      toast.error("Enter agent code");
      return;
    }
    try {
      const res = await fetch("/api/agent/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: p.id, pin, action: "link", agentCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to link agent");
        return;
      }
      toast.success("Agent linked");
      setAgentPinOpen((s) => ({ ...s, [p.id]: false }));
      setAgentPinInput((s) => ({ ...s, [p.id]: "" }));
      await load();
    } catch {
      toast.error("Network error");
    }
  };

  const unlinkAgent = async (p: ApiPolicy) => {
    const pin = agentPinInput[p.id] || "";
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("Enter your PIN to unlink");
      return;
    }
    try {
      const res = await fetch("/api/agent/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: p.id, pin, action: "unlink" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to unlink agent");
        return;
      }
      toast.success("Agent unlinked");
      setAgentPinInput((s) => ({ ...s, [p.id]: "" }));
      await load();
    } catch {
      toast.error("Network error");
    }
  };

  // Coverage summary — hide entirely if nothing to show, hide each field if empty.
  const coverageRows = useMemo(() => {
    const sumTotal = policies.reduce((acc, p) => {
      const n = Number(String(p.sumInsured || "").replace(/[^\d.]/g, ""));
      return Number.isFinite(n) ? acc + n : acc;
    }, 0);
    const rows: { label: string; value: string }[] = [];
    if (sumTotal > 0) {
      rows.push({ label: "Total sum insured (approx.)", value: `₹${sumTotal.toLocaleString("en-IN")}` });
    }
    const roomRents = policies.map((p) => p.roomRentLimit).filter(Boolean) as string[];
    if (roomRents.length) rows.push({ label: "Room rent limit(s)", value: roomRents.join(" · ") });
    const coPays = policies.map((p) => p.coPayPercent).filter(Boolean) as string[];
    if (coPays.length) rows.push({ label: "Co-pay", value: coPays.join(" · ") });
    const waits = policies.map((p) => p.waitingPeriodNote).filter(Boolean) as string[];
    if (waits.length) rows.push({ label: "Waiting period notes", value: waits.join(" · ") });
    return rows;
  }, [policies]);

  const informMessageFor = (p: ApiPolicy) =>
    buildInformInsurerMessage({
      holderName: holderName || "Cardholder",
      cardId: healthId,
      insurerName: p.insurerName,
      policyNumberLast4: p.policyNumber ? p.policyNumber.replace(/\D/g, "").slice(-4) : null,
      hospitalName: "",
      date: new Date().toISOString().slice(0, 10),
    });

  return (
    <div className="space-y-4" data-testid="policy-wallet">
      <PolicyLegalFooter />

      {flags.policyReminders ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--gold-border)] bg-black/30 p-3 text-xs text-[var(--text-soft)]">
          <span>Renewal reminders via calendar export are always available.</span>
          {flags.policyPush ? (
            <button
              type="button"
              disabled={pushBusy}
              onClick={() => void togglePush()}
              className="rounded-lg border border-[var(--gold-border)] px-3 py-1.5 font-semibold text-[var(--gold)]"
              data-testid="policy-push-toggle"
            >
              {reminderPrefs.push
                ? "🔔 Push reminders ON"
                : "🔕 Enable push reminders"}
            </button>
          ) : null}
        </div>
      ) : null}

      {coverageRows.length > 0 ? (
        <div className="rounded-xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-4">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--gold)]">
            Coverage summary / कवरेज सारांश
          </h3>
          <div className="space-y-1 text-sm text-[var(--text-soft)]">
            {coverageRows.map((r) => (
              <p key={r.label}>
                <span className="text-white">{r.label}:</span> {r.value}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--text-soft)]">Loading policies… / लोड हो रहा है…</p>
      ) : policies.length === 0 ? (
        <p className="text-sm text-[var(--text-soft)]">
          No policies added yet. / अभी कोई पॉलिसी नहीं जोड़ी गई।
        </p>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => {
            const label = POLICY_TYPE_LABELS[p.type] || POLICY_TYPE_LABELS.other;
            const endLabel = formatPolicyDateDMY(p.endDate);
            const groupViaEmployer = isGroupViaEmployer(p, workDetails);
            return (
              <div
                key={p.id}
                className="space-y-2 rounded-xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-4"
                data-testid={`policy-card-${p.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">
                      {p.insurerName} — {label.en} / {label.hi}
                    </p>
                    <p className="text-xs text-[var(--text-soft)]">
                      {p.policyNumber ? `#${p.policyNumber}` : "No policy number on file"}
                      {endLabel ? ` · Ends ${endLabel}` : ""}
                    </p>
                  </div>
                  <PolicyStatusChip status={p.status} />
                </div>

                {groupViaEmployer ? (
                  <span className="inline-block rounded-full border border-[var(--gold-border)] bg-black/30 px-2.5 py-0.5 text-[11px] text-[var(--gold)]">
                    Group policy via {workDetails?.organisationName} / नियोक्ता के माध्यम से सामूहिक पॉलिसी
                  </span>
                ) : null}

                {(p.status === "expiring_soon" || p.status === "expired") && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100">
                    {p.status === "expired"
                      ? "This policy has expired — renew soon. / यह पॉलिसी समाप्त हो गई है।"
                      : "Renewal due soon. / नवीनीकरण जल्द देय है।"}
                  </div>
                )}

                {p.nominee && (p.nominee.name || p.nominee.phone) ? (
                  <p className="text-xs text-[var(--text-soft)]">
                    Nominee: {p.nominee.name} {p.nominee.relation ? `(${p.nominee.relation})` : ""}{" "}
                    {p.nominee.phone ? `· ${p.nominee.phone}` : ""}
                  </p>
                ) : null}

                <label className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={p.showOnEmergencyScan !== false}
                    onChange={() => void toggleEmergencyScan(p)}
                  />
                  Show on emergency scan / आपातकालीन स्कैन पर दिखाएँ
                </label>

                {/* Documents */}
                <div className="space-y-1">
                  {p.documents.map((d) => (
                    <button
                      key={d.storagePath}
                      type="button"
                      onClick={() => void viewDoc(p, d.storagePath)}
                      className="block text-xs text-[var(--gold)] underline"
                    >
                      📎 {d.fileName} ({d.kind})
                    </button>
                  ))}
                  {p.documents.length < MAX_DOCS_PER_POLICY ? (
                    <label className="inline-block cursor-pointer rounded-lg border border-dashed border-[var(--gold-border)] px-3 py-1.5 text-xs text-[var(--gold)]">
                      + Upload document / दस्तावेज़ अपलोड करें
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void onUploadDoc(p, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : null}
                </div>

                {/* Action row */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => beginEdit(p)}
                    className="rounded-lg border border-[var(--gold-border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold)]"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePolicy(p.id)}
                    className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300"
                  >
                    🗑 Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setInformFor(p)}
                    className="rounded-lg border border-[var(--gold-border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold)]"
                  >
                    Inform Insurer
                  </button>
                  {flags.policyReminders && p.endDate ? (
                    <button
                      type="button"
                      onClick={() => downloadIcs(p)}
                      className="rounded-lg border border-[var(--gold-border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold)]"
                    >
                      📅 Download .ics
                    </button>
                  ) : null}
                  {flags.insurerLinks ? (
                    <button
                      type="button"
                      onClick={() => void openInsurerWebsite(p)}
                      className="rounded-lg border border-[var(--gold-border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold)]"
                    >
                      🌐 Insurer website
                    </button>
                  ) : null}
                  {flags.cashlessPdf ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCashlessPinOpen((s) => ({ ...s, [p.id]: !s[p.id] }))
                      }
                      className="rounded-lg border border-[var(--gold-border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold)]"
                    >
                      🧾 Cashless info sheet PDF
                    </button>
                  ) : null}
                  {flags.familyFloater && p.isFamilyFloater ? (
                    <button
                      type="button"
                      onClick={() => void toggleFloater(p)}
                      className="rounded-lg border border-[var(--gold-border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold)]"
                    >
                      👪 Family floater
                    </button>
                  ) : null}
                  {flags.agentConnect ? (
                    <button
                      type="button"
                      onClick={() => setAgentPinOpen((s) => ({ ...s, [p.id]: !s[p.id] }))}
                      className="rounded-lg border border-[var(--gold-border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold)]"
                    >
                      🧑‍💼 {p.agent ? "Change agent" : "Link agent"}
                    </button>
                  ) : null}
                  {flags.claimHelper ? (
                    <button
                      type="button"
                      onClick={() => void toggleClaims(p.id)}
                      className="rounded-lg border border-[var(--gold-border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold)]"
                    >
                      🩺 Claims
                    </button>
                  ) : null}
                </div>

                {/* Cashless PDF PIN prompt */}
                {cashlessPinOpen[p.id] ? (
                  <div className="flex gap-2 pt-1">
                    <GoldInput
                      label="PIN"
                      type="password"
                      inputMode="numeric"
                      value={cashlessPinInput[p.id] || ""}
                      onChange={(e) =>
                        setCashlessPinInput((s) => ({
                          ...s,
                          [p.id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                    />
                    <GoldButton
                      disabled={cashlessBusy === p.id}
                      onClick={() => void downloadCashlessPdf(p)}
                    >
                      {cashlessBusy === p.id ? "…" : "Download"}
                    </GoldButton>
                  </div>
                ) : null}

                {/* Agent link */}
                {agentPinOpen[p.id] ? (
                  <div className="space-y-2 rounded-lg border border-[var(--gold-border)] p-3">
                    {p.agent ? (
                      <p className="text-xs text-[var(--text-soft)]">
                        Current: {p.agent.name} ({p.agent.agentCode}) · {p.agent.phone}
                      </p>
                    ) : null}
                    <GoldInput
                      label="Agent code"
                      value={agentCodeInput[p.id] || ""}
                      onChange={(e) =>
                        setAgentCodeInput((s) => ({ ...s, [p.id]: e.target.value.toUpperCase() }))
                      }
                      placeholder="AG-XXXXX"
                    />
                    <GoldInput
                      label="Your PIN"
                      type="password"
                      inputMode="numeric"
                      value={agentPinInput[p.id] || ""}
                      onChange={(e) =>
                        setAgentPinInput((s) => ({
                          ...s,
                          [p.id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      <GoldButton className="flex-1" onClick={() => void linkAgent(p)}>
                        Link
                      </GoldButton>
                      {p.agent ? (
                        <OutlineButton className="flex-1" onClick={() => void unlinkAgent(p)}>
                          Unlink
                        </OutlineButton>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* Family floater members */}
                {floaterOpen[p.id] ? (
                  <div className="space-y-2 rounded-lg border border-[var(--gold-border)] p-3">
                    {(floaterMembers[p.id] || []).map((m) => (
                      <div key={m} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-[var(--gold)]">{m}</span>
                        <button
                          type="button"
                          className="text-red-400"
                          onClick={() => void unlinkFloaterMember(p, m)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <GoldInput
                        label=""
                        placeholder="Member Health ID"
                        value={floaterInput[p.id] || ""}
                        onChange={(e) =>
                          setFloaterInput((s) => ({ ...s, [p.id]: e.target.value }))
                        }
                      />
                      <GoldButton onClick={() => void linkFloaterMember(p)}>Add</GoldButton>
                    </div>
                  </div>
                ) : null}

                {/* Claim helper */}
                {expandedClaims[p.id] ? (
                  <div className="space-y-3 rounded-lg border border-[var(--gold-border)] p-3">
                    {(claimsByPolicy[p.id] || []).map((c) => (
                      <div key={c.id} className="space-y-2 rounded-lg border border-[var(--gold-border)]/60 p-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-white">
                            {(CLAIM_TYPE_LABELS[c.claimType] || CLAIM_TYPE_LABELS.reimbursement).en}
                          </p>
                          <button
                            type="button"
                            className="text-xs text-red-400"
                            onClick={() => void deleteClaim(p.id, c.id)}
                          >
                            Delete
                          </button>
                        </div>
                        <select
                          className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-2 py-1.5 text-xs"
                          value={c.status}
                          onChange={(e) =>
                            void updateClaimStatus(p.id, c.id, e.target.value as ClaimStatus)
                          }
                        >
                          {CLAIM_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {(CLAIM_STATUS_LABELS[s] || { en: s }).en}
                            </option>
                          ))}
                        </select>
                        <div className="space-y-1">
                          {c.checklist.map((item) => (
                            <label key={item.id} className="flex items-start gap-2 text-xs text-[var(--text-soft)]">
                              <input
                                type="checkbox"
                                checked={!!c.checklistTicks[item.id]}
                                onChange={() => void toggleChecklistTick(p.id, c, item.id)}
                              />
                              <span>{item.en} / {item.hi}</span>
                            </label>
                          ))}
                        </div>
                        <div className="text-[11px] text-[var(--text-soft)]">
                          {c.timeline.map((t, i) => (
                            <p key={i}>
                              {(CLAIM_STATUS_LABELS[t.status] || { en: t.status }).en} —{" "}
                              {new Date(t.at).toLocaleString("en-IN")}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="space-y-2 rounded-lg border border-dashed border-[var(--gold-border)] p-2">
                      <p className="text-xs uppercase tracking-wider text-[var(--gold)]">Start a claim</p>
                      <select
                        className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-2 py-1.5 text-xs"
                        value={newClaim[p.id]?.claimType || ""}
                        onChange={(e) =>
                          setNewClaim((s) => ({
                            ...s,
                            [p.id]: {
                              claimType: e.target.value as ClaimType,
                              hospital: s[p.id]?.hospital || "",
                              admissionDate: s[p.id]?.admissionDate || "",
                            },
                          }))
                        }
                      >
                        <option value="">Claim type</option>
                        {CLAIM_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {(CLAIM_TYPE_LABELS[t] || { en: t }).en}
                          </option>
                        ))}
                      </select>
                      <GoldInput
                        label="Hospital (optional)"
                        value={newClaim[p.id]?.hospital || ""}
                        onChange={(e) =>
                          setNewClaim((s) => ({
                            ...s,
                            [p.id]: {
                              claimType: s[p.id]?.claimType || "",
                              hospital: e.target.value,
                              admissionDate: s[p.id]?.admissionDate || "",
                            },
                          }))
                        }
                      />
                      <GoldInput
                        label="Admission date (optional)"
                        type="date"
                        value={newClaim[p.id]?.admissionDate || ""}
                        onChange={(e) =>
                          setNewClaim((s) => ({
                            ...s,
                            [p.id]: {
                              claimType: s[p.id]?.claimType || "",
                              hospital: s[p.id]?.hospital || "",
                              admissionDate: e.target.value,
                            },
                          }))
                        }
                      />
                      <GoldButton className="w-full" onClick={() => void startClaim(p.id)}>
                        Start claim / दावा शुरू करें
                      </GoldButton>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {!showForm ? (
        policies.length < MAX_POLICIES ? (
          <GoldButton className="w-full" onClick={beginAdd} data-testid="policy-add-open">
            + Add policy / पॉलिसी जोड़ें
          </GoldButton>
        ) : (
          <p className="text-xs text-[var(--text-soft)]">
            Maximum {MAX_POLICIES} policies reached.
          </p>
        )
      ) : (
        <div className="space-y-3 rounded-xl border border-[var(--gold-border)] bg-black/30 p-4" data-testid="policy-form">
          <h3 className="text-sm uppercase tracking-wider text-[var(--gold)]">
            {editingId ? "Edit policy / पॉलिसी बदलें" : "Add policy / पॉलिसी जोड़ें"}
          </h3>

          <select
            className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-3 py-2 text-sm"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PolicyType }))}
          >
            <option value="">Policy type / प्रकार</option>
            {POLICY_TYPES.map((t) => (
              <option key={t} value={t}>
                {(POLICY_TYPE_LABELS[t] || { en: t }).en} / {(POLICY_TYPE_LABELS[t] || { hi: t }).hi}
              </option>
            ))}
          </select>

          <GoldInput
            label="Insurer name"
            list="policy-insurer-suggestions"
            value={form.insurerName}
            onChange={(e) => setForm((f) => ({ ...f, insurerName: e.target.value }))}
          />
          <datalist id="policy-insurer-suggestions">
            {INSURER_NAME_SUGGESTIONS.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <GoldInput
            label="Policy number (optional)"
            value={form.policyNumber}
            onChange={(e) => setForm((f) => ({ ...f, policyNumber: e.target.value }))}
          />
          <GoldInput
            label="Member / health card ID (optional)"
            value={form.memberId}
            onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
          />
          <GoldInput
            label="TPA name (optional)"
            value={form.tpaName}
            onChange={(e) => setForm((f) => ({ ...f, tpaName: e.target.value }))}
          />
          <GoldInput
            label="Cashless helpline (optional)"
            value={form.cashlessHelpline}
            onChange={(e) =>
              setForm((f) => ({ ...f, cashlessHelpline: e.target.value.replace(/[^\d+]/g, "") }))
            }
          />
          <GoldInput
            label="Claim helpline (optional)"
            value={form.claimHelpline}
            onChange={(e) =>
              setForm((f) => ({ ...f, claimHelpline: e.target.value.replace(/[^\d+]/g, "") }))
            }
          />
          <GoldInput
            label="Sum insured (optional)"
            value={form.sumInsured}
            onChange={(e) => setForm((f) => ({ ...f, sumInsured: e.target.value }))}
          />
          <GoldInput
            label="Room rent limit (optional)"
            value={form.roomRentLimit}
            onChange={(e) => setForm((f) => ({ ...f, roomRentLimit: e.target.value }))}
          />
          <GoldInput
            label="Co-pay % (optional)"
            value={form.coPayPercent}
            onChange={(e) => setForm((f) => ({ ...f, coPayPercent: e.target.value }))}
          />
          <GoldInput
            label="Waiting period note (optional)"
            value={form.waitingPeriodNote}
            onChange={(e) => setForm((f) => ({ ...f, waitingPeriodNote: e.target.value }))}
          />
          <GoldInput
            label="Start date (optional)"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
          <GoldInput
            label="End date (optional)"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          />

          <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
            <input
              type="checkbox"
              checked={form.isFamilyFloater}
              onChange={(e) => setForm((f) => ({ ...f, isFamilyFloater: e.target.checked }))}
            />
            Family floater policy / फैमिली फ्लोटर
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
            <input
              type="checkbox"
              checked={form.showOnEmergencyScan}
              onChange={(e) => setForm((f) => ({ ...f, showOnEmergencyScan: e.target.checked }))}
            />
            Show on emergency scan / आपातकालीन स्कैन पर दिखाएँ
          </label>

          <p className="pt-1 text-xs font-semibold text-[var(--gold)]">
            Nominee / नॉमिनी (optional)
          </p>
          <GoldInput
            label="Nominee name"
            value={form.nomineeName}
            onChange={(e) => setForm((f) => ({ ...f, nomineeName: e.target.value }))}
          />
          <GoldInput
            label="Relation"
            value={form.nomineeRelation}
            onChange={(e) => setForm((f) => ({ ...f, nomineeRelation: e.target.value }))}
          />
          <GoldInput
            label="Phone"
            value={form.nomineePhone}
            onChange={(e) =>
              setForm((f) => ({ ...f, nomineePhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
            }
            inputMode="numeric"
          />

          <div className="flex gap-2 pt-1">
            <GoldButton className="flex-1" disabled={saving} onClick={() => void submitForm()}>
              {saving ? "Saving…" : "Save / सेव"}
            </GoldButton>
            <OutlineButton className="flex-1" disabled={saving} onClick={resetForm}>
              Cancel
            </OutlineButton>
          </div>
        </div>
      )}

      <InformInsurerSheet
        open={!!informFor}
        onClose={() => setInformFor(null)}
        insurerName={informFor?.insurerName}
        message={informFor ? informMessageFor(informFor) : ""}
        cashlessHelpline={informFor?.cashlessHelpline}
        claimHelpline={informFor?.claimHelpline}
      />
    </div>
  );
}

/**
 * Lightweight top-of-page renewal banner for /my-profile — loads policies
 * itself so it can render before the Policies section is expanded.
 */
export function PolicyRenewalBanner({ flags }: { flags: Flags }) {
  const [policies, setPolicies] = useState<ApiPolicy[] | null>(null);

  useEffect(() => {
    if (!flags.policyWallet || !flags.policyReminders) return;
    fetch("/api/policies")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPolicies(d?.policies || []))
      .catch(() => {});
  }, [flags.policyWallet, flags.policyReminders]);

  if (!flags.policyWallet || !flags.policyReminders || !policies) return null;
  const due = policies.filter((p) => p.status === "expiring_soon" || p.status === "expired");
  if (due.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100"
      data-testid="policy-renewal-banner"
    >
      {due.length} polic{due.length > 1 ? "ies" : "y"} need renewal attention — see Policies
      section below. / {due.length} पॉलिसी नवीनीकरण हेतु ध्यान चाहती हैं।
    </div>
  );
}
