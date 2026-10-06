import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  requireOwnerSession,
  requirePack2Feature,
} from "@/lib/patientEase/auth";
import {
  medicineCalendar,
  visitCalendar,
  type MedicineEntry,
  type FollowUpVisit,
} from "@/lib/patientEase/helpers";
import { loadFeatureFlags } from "@/lib/features/server";
import { isFeatureOn } from "@/lib/features/flags";
import { JAN_AUSHADHI_LOCATOR } from "@/lib/patientEase/officialLinks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const feat = await requirePack2Feature("followUpPlanner");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  const p = snap.data() || {};
  const medicines = (p.followUpMedicines || []) as MedicineEntry[];
  const visits = (p.followUpVisits || []) as FollowUpVisit[];
  const flags = await loadFeatureFlags();
  return NextResponse.json(
    {
      medicines: medicines.map((m) => ({ ...m, calendar: medicineCalendar(m) })),
      visits: visits.map((v) => ({ ...v, calendar: visitCalendar(v) })),
      janAushadhiLocator: isFeatureOn(flags, "janAushadhi")
        ? JAN_AUSHADHI_LOCATOR
        : null,
    },
    { headers: noStoreHeaders() }
  );
}

export async function POST(req: NextRequest) {
  const feat = await requirePack2Feature("followUpPlanner");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const body = await req.json().catch(() => ({}));
  const db = getAdminDb();
  const ref = db.collection("profiles").doc(sess.profileId);
  const snap = await ref.get();
  const p = snap.data() || {};

  if (body.type === "medicine") {
    const med: MedicineEntry = {
      name: String(body.name || "").slice(0, 120),
      dose: body.dose ? String(body.dose).slice(0, 80) : null,
      frequency: body.frequency ? String(body.frequency).slice(0, 80) : null,
      times: Array.isArray(body.times)
        ? body.times.map(String).slice(0, 6)
        : [],
      start: body.start ? String(body.start) : null,
      end: body.end ? String(body.end) : null,
    };
    if (!med.name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const medicines = [...((p.followUpMedicines || []) as MedicineEntry[]), med];
    await ref.set(
      { followUpMedicines: medicines, updated_at: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return NextResponse.json(
      { ok: true, medicine: { ...med, calendar: medicineCalendar(med) } },
      { headers: noStoreHeaders() }
    );
  }

  if (body.type === "visit") {
    const visit: FollowUpVisit = {
      id: randomBytes(8).toString("hex"),
      title: String(body.title || "Follow-up").slice(0, 120),
      whenIso: String(body.whenIso || new Date().toISOString()),
      notes: body.notes ? String(body.notes).slice(0, 500) : null,
    };
    const visits = [...((p.followUpVisits || []) as FollowUpVisit[]), visit];
    await ref.set(
      { followUpVisits: visits, updated_at: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return NextResponse.json(
      { ok: true, visit: { ...visit, calendar: visitCalendar(visit) } },
      { headers: noStoreHeaders() }
    );
  }

  return NextResponse.json({ error: "type medicine|visit required" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const feat = await requirePack2Feature("followUpPlanner");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const body = await req.json().catch(() => ({}));
  const db = getAdminDb();
  const ref = db.collection("profiles").doc(sess.profileId);
  const snap = await ref.get();
  const p = snap.data() || {};
  if (body.type === "medicine") {
    const name = String(body.name || "");
    const medicines = ((p.followUpMedicines || []) as MedicineEntry[]).filter(
      (m) => m.name !== name
    );
    await ref.set({ followUpMedicines: medicines }, { merge: true });
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  }
  if (body.type === "visit") {
    const id = String(body.id || "");
    const visits = ((p.followUpVisits || []) as FollowUpVisit[]).filter(
      (v) => v.id !== id
    );
    await ref.set({ followUpVisits: visits }, { merge: true });
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  }
  return NextResponse.json({ error: "bad request" }, { status: 400 });
}
