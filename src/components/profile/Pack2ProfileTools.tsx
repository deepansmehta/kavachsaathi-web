"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { COVERAGE_DISCLAIMER } from "@/lib/patientEase/coverage";
import { JAN_AUSHADHI_LOCATOR } from "@/lib/patientEase/officialLinks";

type Flags = Record<string, boolean>;

type Props = {
  flags: Flags;
  healthId: string;
  name: string;
};

/** Pack 2 owner tools for /my-profile — each section gated by its flag. */
export function Pack2ProfileTools({ flags, healthId, name }: Props) {
  const any =
    flags.coverageSnapshot ||
    flags.dischargeChecklist ||
    flags.documentPack ||
    flags.billRequestLetter ||
    flags.claimDeadline ||
    flags.attendantPass ||
    flags.doctorSummary ||
    flags.followUpPlanner ||
    flags.schemeGuide ||
    flags.janAushadhi ||
    flags.disclosureVault;
  if (!any) return null;

  return (
    <section className="no-print space-y-4 rounded-xl border border-amber-500/30 bg-black/40 p-4">
      <h2 className="font-[Rajdhani] text-lg font-bold text-amber-300">
        Patient Ease
      </h2>
      {flags.schemeGuide && (
        <a href="/schemes" className="block text-sm text-amber-200 underline">
          Government scheme guide
        </a>
      )}
      {flags.janAushadhi && (
        <a
          href={JAN_AUSHADHI_LOCATOR}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-amber-200 underline"
        >
          Jan Aushadhi Kendra locator (official)
        </a>
      )}
      {flags.coverageSnapshot && <CoverageEditor />}
      {flags.dischargeChecklist && <DischargeEditor />}
      {flags.documentPack && <DocPackButton />}
      {flags.billRequestLetter && <BillLetterEditor name={name} />}
      {flags.claimDeadline && <ClaimDeadlineEditor />}
      {flags.attendantPass && <AttendantPassEditor />}
      {flags.doctorSummary && <DoctorSummaryButton />}
      {flags.followUpPlanner && <FollowUpEditor />}
      {flags.disclosureVault && <DisclosureNote />}
      <p className="text-[11px] text-stone-500">Card {healthId}</p>
    </section>
  );
}

function CoverageEditor() {
  const [roomTip, setRoomTip] = useState<string | null>(null);
  const [sum, setSum] = useState("");
  const [roomDay, setRoomDay] = useState("");
  const save = async () => {
    const r = await fetch("/api/coverage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coverage: {
          sumInsured: sum ? Number(sum) : null,
          roomRentLimit: {
            type: roomDay ? "day" : "none",
            value: roomDay ? Number(roomDay) : null,
          },
        },
      }),
    });
    const j = await r.json();
    if (!r.ok) return toast.error(j.error || "Failed");
    setRoomTip(j.roomTip || null);
    toast.success("Coverage saved");
  };
  useEffect(() => {
    fetch("/api/coverage")
      .then((r) => r.json())
      .then((j) => {
        if (j.coverage?.sumInsured != null) setSum(String(j.coverage.sumInsured));
        if (j.coverage?.roomRentLimit?.value != null)
          setRoomDay(String(j.coverage.roomRentLimit.value));
        setRoomTip(j.roomTip || null);
      })
      .catch(() => undefined);
  }, []);
  return (
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <h3 className="text-sm font-semibold text-amber-100">Your Coverage</h3>
      {roomTip && (
        <p className="text-sm font-bold text-amber-200">{roomTip}</p>
      )}
      <input
        className="w-full rounded bg-black/50 p-2 text-sm"
        placeholder="Sum insured ₹"
        value={sum}
        onChange={(e) => setSum(e.target.value)}
      />
      <input
        className="w-full rounded bg-black/50 p-2 text-sm"
        placeholder="Room rent limit ₹/day"
        value={roomDay}
        onChange={(e) => setRoomDay(e.target.value)}
      />
      <button
        type="button"
        onClick={() => void save()}
        className="rounded bg-amber-600 px-3 py-1 text-sm text-black"
      >
        Save coverage
      </button>
      <p className="text-[11px] text-stone-400">{COVERAGE_DISCLAIMER}</p>
    </div>
  );
}

function DischargeEditor() {
  const [stays, setStays] = useState<
    { id: string; progress: { label: string }; mode: string }[]
  >([]);
  const load = useCallback(() => {
    fetch("/api/discharge-checklist")
      .then((r) => r.json())
      .then((j) => setStays(j.stays || []))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const create = async (mode: string) => {
    const r = await fetch("/api/discharge-checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", mode, hospital: "Hospital" }),
    });
    if (!r.ok) return toast.error("Failed");
    toast.success("Stay checklist created");
    load();
  };
  return (
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <h3 className="text-sm font-semibold">Discharge checklist</h3>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-white/10 px-2 py-1 text-xs"
          onClick={() => void create("cashless")}
        >
          + Cashless
        </button>
        <button
          type="button"
          className="rounded bg-white/10 px-2 py-1 text-xs"
          onClick={() => void create("reimbursement")}
        >
          + Reimbursement
        </button>
      </div>
      <ul className="text-xs text-stone-300">
        {stays.map((s) => (
          <li key={s.id}>
            {s.mode}: {s.progress?.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocPackButton() {
  return (
    <button
      type="button"
      className="rounded bg-amber-700/80 px-3 py-2 text-sm"
      onClick={() => {
        void (async () => {
          const r = await fetch("/api/document-pack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            toast.error(j.error || "Failed");
            return;
          }
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "kavach-document-pack.pdf";
          a.click();
          URL.revokeObjectURL(url);
        })();
      }}
    >
      Download document pack PDF
    </button>
  );
}

function BillLetterEditor({ name }: { name: string }) {
  const [hospital, setHospital] = useState("");
  const [ip, setIp] = useState("");
  const [adm, setAdm] = useState("");
  return (
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <h3 className="text-sm font-semibold">Bill request letter</h3>
      <input
        className="w-full rounded bg-black/50 p-2 text-sm"
        placeholder="Hospital"
        value={hospital}
        onChange={(e) => setHospital(e.target.value)}
      />
      <input
        className="w-full rounded bg-black/50 p-2 text-sm"
        placeholder="IP / UHID"
        value={ip}
        onChange={(e) => setIp(e.target.value)}
      />
      <input
        className="w-full rounded bg-black/50 p-2 text-sm"
        placeholder="Admission date"
        value={adm}
        onChange={(e) => setAdm(e.target.value)}
      />
      <button
        type="button"
        className="rounded bg-white/15 px-3 py-1 text-sm"
        onClick={() => {
          void (async () => {
            const r = await fetch("/api/bill-letter", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                patientName: name,
                hospital,
                ipUhid: ip,
                admissionDate: adm,
              }),
            });
            if (!r.ok) return toast.error("Failed");
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "bill-request-letter.pdf";
            a.click();
            URL.revokeObjectURL(url);
          })();
        }}
      >
        Download letter PDF
      </button>
    </div>
  );
}

function ClaimDeadlineEditor() {
  const [dischargeDate, setDischargeDate] = useState("");
  const [windowDays, setWindowDays] = useState("30");
  const [label, setLabel] = useState("");
  const save = async () => {
    const r = await fetch("/api/claim-deadline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dischargeDate, windowDays: Number(windowDays) }),
    });
    const j = await r.json();
    if (!r.ok) return toast.error(j.error || "Failed");
    setLabel(j.countdown?.label || "");
    if (j.googleCalendarUrl) window.open(j.googleCalendarUrl, "_blank");
    toast.success("Claim deadline saved");
  };
  return (
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <h3 className="text-sm font-semibold">Claim deadline</h3>
      {label && <p className="text-sm text-amber-200">{label}</p>}
      <input
        type="date"
        className="w-full rounded bg-black/50 p-2 text-sm"
        value={dischargeDate}
        onChange={(e) => setDischargeDate(e.target.value)}
      />
      <input
        className="w-full rounded bg-black/50 p-2 text-sm"
        placeholder="Claim window (days)"
        value={windowDays}
        onChange={(e) => setWindowDays(e.target.value)}
      />
      <button
        type="button"
        className="rounded bg-white/15 px-3 py-1 text-sm"
        onClick={() => void save()}
      >
        Save + calendar
      </button>
    </div>
  );
}

function AttendantPassEditor() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const create = async () => {
    const r = await fetch("/api/attendant-pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendantName: name, hours: 12, includeIds: false }),
    });
    const j = await r.json();
    if (!r.ok) return toast.error(j.error || "Failed");
    setUrl(j.url || "");
    if (j.shareWhatsapp) window.open(j.shareWhatsapp, "_blank");
    toast.success("Pass created (copy link once)");
  };
  return (
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <h3 className="text-sm font-semibold">Attendant pass</h3>
      <input
        className="w-full rounded bg-black/50 p-2 text-sm"
        placeholder="Attendant name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="button"
        className="rounded bg-white/15 px-3 py-1 text-sm"
        onClick={() => void create()}
      >
        Create 12h pass
      </button>
      {url && (
        <p className="break-all text-[11px] text-stone-400">
          One-time link: {url}
        </p>
      )}
    </div>
  );
}

function DoctorSummaryButton() {
  return (
    <button
      type="button"
      className="rounded bg-white/15 px-3 py-2 text-sm"
      onClick={() => {
        window.open("/api/doctor-summary?format=pdf", "_blank");
      }}
    >
      Doctor summary PDF
    </button>
  );
}

function FollowUpEditor() {
  const [med, setMed] = useState("");
  return (
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <h3 className="text-sm font-semibold">Follow-up planner</h3>
      <input
        className="w-full rounded bg-black/50 p-2 text-sm"
        placeholder="Medicine name"
        value={med}
        onChange={(e) => setMed(e.target.value)}
      />
      <button
        type="button"
        className="rounded bg-white/15 px-3 py-1 text-sm"
        onClick={() => {
          void (async () => {
            const r = await fetch("/api/follow-up", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "medicine", name: med }),
            });
            const j = await r.json();
            if (!r.ok) return toast.error(j.error || "Failed");
            if (j.medicine?.calendar?.googleCalendarUrl)
              window.open(j.medicine.calendar.googleCalendarUrl, "_blank");
            toast.success("Medicine added");
          })();
        }}
      >
        Add medicine + calendar
      </button>
    </div>
  );
}

function DisclosureNote() {
  return (
    <p className="text-xs text-stone-400">
      Disclosure vault (proposal / declaration / schedule) is available via API
      in PIN mode — files never appear on the emergency view.
    </p>
  );
}
