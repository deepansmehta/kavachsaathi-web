"use client";

/**
 * Pack2ProfileTools — F14–F25 owner tools for /my-profile.
 * Each section is gated by its feature flag.
 * Mount alongside Pack3ProfileTools in my-profile.
 */

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import toast from "react-hot-toast";
import { SCHEMES, E_RAKT_KOSH, JAN_AUSHADHI_INFO } from "@/lib/patientEase/officialLinks";
import { visitCalendarUrl, visitIcs, VISIT_TYPE_LABELS, MED_FREQ_LABELS, ALLOWED_VISIT_TYPES, ALLOWED_FREQUENCIES, type FollowUpMedicine, type FollowUpVisit, type VisitType, type MedFrequency } from "@/lib/patientEase/followUp";
import type { DisclosureDocType } from "@/app/api/disclosure-vault/route";

type Flags = Record<string, boolean>;

type Props = {
  flags: Flags;
  healthId: string;
  name?: string;
};

type DisclosureRecord = {
  id: string;
  type: string;
  policyNo?: string | null;
  date?: string | null;
  contentType: string;
  size: number;
  url: string | null;
  uploadedAt?: string;
};

export function Pack2ProfileTools({ flags }: Props) {  const [pin, setPin] = useState("");
  const [docSummaryLoading, setDocSummaryLoading] = useState(false);

  // Follow-up
  const [medicines, setMedicines] = useState<FollowUpMedicine[]>([]);
  const [visits, setVisits] = useState<FollowUpVisit[]>([]);
  const [fuLoaded, setFuLoaded] = useState(false);
  const [fuBusy, setFuBusy] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", dose: "", frequency: "once_daily" as MedFrequency, startDate: "", endDate: "" });
  const [newVisit, setNewVisit] = useState({ title: "", type: "follow_up" as VisitType, dueDate: "", doctor: "", hospital: "" });

  // Disclosure vault
  const [discRecords, setDiscRecords] = useState<DisclosureRecord[]>([]);
  const [discLoaded, setDiscLoaded] = useState(false);
  const [discUploadType, setDiscUploadType] = useState<DisclosureDocType>("proposal_form");
  const [discPolicyNo, setDiscPolicyNo] = useState("");
  const [discDate, setDiscDate] = useState("");
  const [discFile, setDiscFile] = useState<File | null>(null);
  const [discUploading, setDiscUploading] = useState(false);

  const loadFollowUp = useCallback(async () => {
    if (!flags.followUpPlanner || fuLoaded) return;
    setFuLoaded(true);
    try {
      const r = await fetch("/api/follow-up");
      if (!r.ok) return;
      const d = await r.json();
      setMedicines(d.medicines || []);
      setVisits(d.visits || []);
    } catch { /* */ }
  }, [flags.followUpPlanner, fuLoaded]);

  const loadDisclosure = useCallback(async () => {
    if (!flags.disclosureVault || discLoaded) return;
    setDiscLoaded(true);
    try {
      const r = await fetch("/api/disclosure-vault");
      if (!r.ok) return;
      const d = await r.json();
      setDiscRecords(d.records || []);
    } catch { /* */ }
  }, [flags.disclosureVault, discLoaded]);

  useEffect(() => {
    void loadFollowUp();
    void loadDisclosure();
  }, [loadFollowUp, loadDisclosure]);

  const downloadDocSummaryPdf = async () => {
    if (!pin || pin.length < 4) {
      toast.error("Re-enter your PIN");
      return;
    }
    setDocSummaryLoading(true);
    try {
      const res = await fetch("/api/doctor-summary?action=pdf", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { error?: string }).error || "Download failed");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kavachsaathi-doctor-summary.pdf";
      a.click();
      toast.success("Doctor summary PDF downloaded");
      setPin("");
    } catch {
      toast.error("Network error");
    } finally {
      setDocSummaryLoading(false);
    }
  };

  const addMedicine = async () => {
    if (!newMed.name.trim()) { toast.error("Medicine name required"); return; }
    setFuBusy(true);
    try {
      const r = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "medicine", ...newMed }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Failed"); return; }
      toast.success("Medicine added");
      setNewMed({ name: "", dose: "", frequency: "once_daily", startDate: "", endDate: "" });
      setFuLoaded(false);
      await loadFollowUp();
    } catch { toast.error("Network error"); }
    finally { setFuBusy(false); }
  };

  const addVisit = async () => {
    if (!newVisit.title.trim() || !newVisit.dueDate) { toast.error("Title and date required"); return; }
    setFuBusy(true);
    try {
      const r = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "visit", ...newVisit }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Failed"); return; }
      toast.success("Visit added");
      setNewVisit({ title: "", type: "follow_up", dueDate: "", doctor: "", hospital: "" });
      setFuLoaded(false);
      await loadFollowUp();
    } catch { toast.error("Network error"); }
    finally { setFuBusy(false); }
  };

  const deleteFollowUp = async (id: string, kind: "medicine" | "visit") => {
    try {
      await fetch(`/api/follow-up?id=${id}&kind=${kind}`, { method: "DELETE" });
      if (kind === "medicine") setMedicines((prev) => prev.filter((m) => m.id !== id));
      else setVisits((prev) => prev.filter((v) => v.id !== id));
      toast.success("Removed");
    } catch { toast.error("Failed"); }
  };

  const markVisitDone = async (v: FollowUpVisit) => {
    try {
      await fetch(`/api/follow-up?id=${v.id}&kind=visit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
      setVisits((prev) => prev.map((x) => (x.id === v.id ? { ...x, done: true } : x)));
    } catch { toast.error("Failed"); }
  };

  const downloadIcs = (v: FollowUpVisit) => {
    const ics = visitIcs(v);
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kavach-visit-${v.id}.ics`;
    a.click();
  };

  const uploadDisclosure = async () => {
    if (!discFile) { toast.error("Select a file"); return; }
    if (discFile.size > 8 * 1024 * 1024) { toast.error("File too large (max 8 MB)"); return; }
    setDiscUploading(true);
    try {
      // Get signed PUT URL
      const signedRes = await fetch("/api/disclosure-vault/signed-put", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: discFile.type }),
      });
      if (!signedRes.ok) {
        const j = await signedRes.json().catch(() => ({}));
        toast.error((j as { error?: string }).error || "Upload init failed");
        return;
      }
      const { url, path } = await signedRes.json();
      // Upload to storage
      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": discFile.type },
        body: discFile,
      });
      if (!uploadRes.ok) { toast.error("Upload failed"); return; }
      // Confirm
      const confirmRes = await fetch("/api/disclosure-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: discUploadType,
          path,
          contentType: discFile.type,
          size: discFile.size,
          policyNo: discPolicyNo.trim() || undefined,
          date: discDate || undefined,
        }),
      });
      if (!confirmRes.ok) {
        const j = await confirmRes.json().catch(() => ({}));
        toast.error((j as { error?: string }).error || "Confirm failed");
        return;
      }
      toast.success("Document uploaded");
      setDiscFile(null);
      setDiscPolicyNo("");
      setDiscDate("");
      setDiscLoaded(false);
      await loadDisclosure();
    } catch { toast.error("Network error"); }
    finally { setDiscUploading(false); }
  };

  const any =
    flags.doctorSummary ||
    flags.followUpPlanner ||
    flags.schemeGuide ||
    flags.needBlood ||
    flags.janAushadhi ||
    flags.disclosureVault;

  if (!any) return null;

  return (
    <div className="no-print space-y-4">
      {/* Doctor Summary */}
      {flags.doctorSummary && (
        <div style={sectionCard}>
          <p style={sectionTitle}>Doctor Summary PDF</p>
          <p style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
            Download a 1-page medical summary to hand to a doctor.
          </p>
          <label style={{ display: "block", fontSize: 12, color: MUTED, marginBottom: 4 }}>
            PIN confirmation
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            disabled={docSummaryLoading}
            onClick={downloadDocSummaryPdf}
            style={primaryBtn}
          >
            {docSummaryLoading ? "Generating…" : "Download Doctor Summary PDF"}
          </button>
        </div>
      )}

      {/* Follow-up Planner */}
      {flags.followUpPlanner && (
        <div style={sectionCard}>
          <p style={sectionTitle}>Follow-up Planner</p>

          {/* Medicines */}
          <p style={{ fontSize: 12, color: GOLD, marginBottom: 6, fontWeight: 700 }}>Medicines</p>
          {medicines.map((m) => (
            <div key={m.id} style={rowStyle}>
              <div>
                <span style={{ color: TEXT, fontSize: 13 }}>
                  {m.name}
                  {m.dose ? ` — ${m.dose}` : ""}
                </span>
                <span style={{ color: MUTED, fontSize: 12, marginLeft: 8 }}>
                  {MED_FREQ_LABELS[m.frequency] || m.frequency}
                </span>
              </div>
              <button type="button" onClick={() => deleteFollowUp(m.id, "medicine")} style={smallGhostBtn}>
                ×
              </button>
            </div>
          ))}
          {/* Add medicine form */}
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <input placeholder="Medicine name *" value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} style={inputStyle} />
            <div style={{ display: "flex", gap: 6 }}>
              <input placeholder="Dose (e.g. 500mg)" value={newMed.dose} onChange={(e) => setNewMed({ ...newMed, dose: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              <select value={newMed.frequency} onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value as MedFrequency })} style={{ ...inputStyle, flex: 1 }}>
                {ALLOWED_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{MED_FREQ_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <button type="button" disabled={fuBusy} onClick={addMedicine} style={outlineBtn}>
              + Add medicine
            </button>
          </div>

          {/* Visits */}
          <p style={{ fontSize: 12, color: GOLD, marginBottom: 6, fontWeight: 700, marginTop: 16 }}>Upcoming Visits</p>
          {visits.map((v) => (
            <div key={v.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <span style={{ color: TEXT, fontSize: 13, fontWeight: v.done ? 400 : 600, textDecoration: v.done ? "line-through" : undefined }}>
                  {v.title}
                </span>
                <button type="button" onClick={() => deleteFollowUp(v.id, "visit")} style={smallGhostBtn}>×</button>
              </div>
              <div style={{ fontSize: 12, color: MUTED }}>
                {VISIT_TYPE_LABELS[v.type] || v.type} · {v.dueDate}
                {v.doctor ? ` · Dr. ${v.doctor}` : ""}
              </div>
              {!v.done && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={visitCalendarUrl(v)} target="_blank" rel="noreferrer" style={{ ...outlineBtn, textDecoration: "none", fontSize: 12, padding: "4px 8px" }}>
                    📅 Google Calendar
                  </a>
                  <button type="button" onClick={() => downloadIcs(v)} style={{ ...outlineBtn, fontSize: 12, padding: "4px 8px" }}>
                    ⬇ .ics
                  </button>
                  <button type="button" onClick={() => markVisitDone(v)} style={{ ...outlineBtn, fontSize: 12, padding: "4px 8px" }}>
                    ✓ Done
                  </button>
                </div>
              )}
            </div>
          ))}
          {/* Add visit form */}
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <input placeholder="Visit title *" value={newVisit.title} onChange={(e) => setNewVisit({ ...newVisit, title: e.target.value })} style={inputStyle} />
            <div style={{ display: "flex", gap: 6 }}>
              <select value={newVisit.type} onChange={(e) => setNewVisit({ ...newVisit, type: e.target.value as VisitType })} style={{ ...inputStyle, flex: 1 }}>
                {ALLOWED_VISIT_TYPES.map((t) => (
                  <option key={t} value={t}>{VISIT_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <input type="date" value={newVisit.dueDate} onChange={(e) => setNewVisit({ ...newVisit, dueDate: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            </div>
            <input placeholder="Doctor name" value={newVisit.doctor} onChange={(e) => setNewVisit({ ...newVisit, doctor: e.target.value })} style={inputStyle} />
            <button type="button" disabled={fuBusy} onClick={addVisit} style={outlineBtn}>
              + Add visit
            </button>
          </div>
        </div>
      )}

      {/* Scheme Guide shortcut */}
      {flags.schemeGuide && (
        <div style={sectionCard}>
          <p style={sectionTitle}>Government Health Schemes</p>
          <p style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
            Schemes you may be eligible for — PM-JAY, ECHS, ESIC and more.
          </p>
          <a href="/schemes" style={{ ...primaryBtn, textDecoration: "none", display: "block", textAlign: "center" }}>
            View Scheme Guide ↗
          </a>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SCHEMES.filter((s) => s.verified).map((s) => (
              <a key={s.id} href={s.officialUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: MUTED, textDecoration: "underline" }}>
                {s.nameEn} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Jan Aushadhi */}
      {flags.janAushadhi && (
        <div style={sectionCard}>
          <p style={sectionTitle}>{JAN_AUSHADHI_INFO.labelEn}</p>
          <p style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
            {JAN_AUSHADHI_INFO.descEn}
          </p>
          <a href={JAN_AUSHADHI_INFO.url} target="_blank" rel="noreferrer" style={{ ...primaryBtn, textDecoration: "none", display: "block", textAlign: "center" }}>
            Find Janaushadhi Kendra ↗
          </a>
          <p style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>
            e-RaktKosh (blood banks):{" "}
            <a href={E_RAKT_KOSH.url} target="_blank" rel="noreferrer" style={{ color: MUTED }}>
              {E_RAKT_KOSH.url} ↗
            </a>
          </p>
        </div>
      )}

      {flags.disclosureVault && (
        <div style={sectionCard}>
          <p style={sectionTitle}>Disclosure Vault</p>
          <p style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
            Store insurance disclosure documents (proposal forms, health declarations, policy schedules). Max 10 files, 8 MB each. Never shared with hospital/emergency.
          </p>

          {discRecords.map((doc) => (
            <div key={doc.id} style={rowStyle}>
              <div>
                <span style={{ color: TEXT, fontSize: 13 }}>{doc.type.replace(/_/g, " ")}</span>
                {doc.policyNo && <span style={{ color: MUTED, fontSize: 12, marginLeft: 6 }}>#{doc.policyNo}</span>}
                {doc.date && <span style={{ color: MUTED, fontSize: 12, marginLeft: 6 }}>{doc.date}</span>}
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: GOLD, fontSize: 12, marginLeft: 8 }}>
                    Open ↗
                  </a>
                )}
              </div>
            </div>
          ))}

          {discRecords.length < 10 && (
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              <select value={discUploadType} onChange={(e) => setDiscUploadType(e.target.value as DisclosureDocType)} style={inputStyle}>
                <option value="proposal_form">Proposal Form</option>
                <option value="health_declaration">Health Declaration</option>
                <option value="policy_schedule">Policy Schedule</option>
              </select>
              <input placeholder="Policy number (optional)" value={discPolicyNo} onChange={(e) => setDiscPolicyNo(e.target.value)} style={inputStyle} />
              <input type="date" value={discDate} onChange={(e) => setDiscDate(e.target.value)} style={inputStyle} />
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setDiscFile(e.target.files?.[0] || null)}
                style={{ color: TEXT, fontSize: 13 }}
              />
              <button type="button" disabled={discUploading} onClick={uploadDisclosure} style={outlineBtn}>
                {discUploading ? "Uploading…" : "Upload document"}
              </button>
            </div>
          )}
        </div>
      )}

      {void 0}
    </div>
  );
}

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FCE49A";
const TEXT = "#F0EEE8";
const MUTED = "#A8A59C";

const sectionCard: CSSProperties = {
  background: "#141410",
  border: `1px solid ${GOLD}44`,
  borderRadius: 14,
  padding: "16px",
};

const sectionTitle: CSSProperties = {
  fontFamily: "Rajdhani, system-ui, sans-serif",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: GOLD,
  marginBottom: 10,
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.4)",
  border: `1px solid ${GOLD}44`,
  borderRadius: 8,
  padding: "8px 10px",
  color: TEXT,
  fontSize: 13,
  boxSizing: "border-box",
};

const primaryBtn: CSSProperties = {
  background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
  color: "#0A0A08",
  fontWeight: 700,
  fontSize: 14,
  border: "none",
  borderRadius: 9,
  padding: "10px 14px",
  cursor: "pointer",
  minHeight: 40,
};

const outlineBtn: CSSProperties = {
  ...primaryBtn,
  background: "transparent",
  color: GOLD_LIGHT,
  border: `1px solid ${GOLD}66`,
  cursor: "pointer",
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: `1px solid ${GOLD}22`,
};

const smallGhostBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  color: MUTED,
  fontSize: 18,
  cursor: "pointer",
  padding: "0 4px",
};
