import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  requireOwnerSession,
  requirePack2Feature,
} from "@/lib/patientEase/auth";
import {
  itemsForMode,
  progress,
  type StayMode,
} from "@/lib/patientEase/dischargeChecklist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const feat = await requirePack2Feature("dischargeChecklist");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const db = getAdminDb();
  const stays = await db
    .collection("profiles")
    .doc(sess.profileId)
    .collection("hospital_stays")
    .orderBy("created_at", "desc")
    .limit(20)
    .get();
  const list = stays.docs.map((d) => {
    const data = d.data();
    const mode = (data.mode === "reimbursement" ? "reimbursement" : "cashless") as StayMode;
    const checked = (data.checked || {}) as Record<string, boolean>;
    return {
      id: d.id,
      hospital: data.hospital || "",
      mode,
      items: itemsForMode(mode),
      checked,
      progress: progress(mode, checked),
      created_at: data.created_at || null,
    };
  });
  return NextResponse.json({ stays: list }, { headers: noStoreHeaders() });
}

export async function POST(req: NextRequest) {
  const feat = await requirePack2Feature("dischargeChecklist");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const body = await req.json().catch(() => ({}));
  const db = getAdminDb();
  const action = String(body.action || "create");

  if (action === "create") {
    const mode = (body.mode === "reimbursement" ? "reimbursement" : "cashless") as StayMode;
    const ref = db
      .collection("profiles")
      .doc(sess.profileId)
      .collection("hospital_stays")
      .doc();
    await ref.set({
      hospital: String(body.hospital || "").slice(0, 200),
      mode,
      checked: {},
      created_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json(
      { ok: true, id: ref.id, items: itemsForMode(mode), progress: progress(mode, {}) },
      { headers: noStoreHeaders() }
    );
  }

  if (action === "tick") {
    const stayId = String(body.stayId || "");
    const itemId = String(body.itemId || "");
    if (!stayId || !itemId) {
      return NextResponse.json({ error: "stayId and itemId required" }, { status: 400 });
    }
    const ref = db
      .collection("profiles")
      .doc(sess.profileId)
      .collection("hospital_stays")
      .doc(stayId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Stay not found" }, { status: 404 });
    }
    const data = snap.data()!;
    const mode = (data.mode === "reimbursement" ? "reimbursement" : "cashless") as StayMode;
    const checked = { ...(data.checked || {}), [itemId]: body.checked !== false };
    await ref.set({ checked, updated_at: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json(
      { ok: true, checked, progress: progress(mode, checked), items: itemsForMode(mode) },
      { headers: noStoreHeaders() }
    );
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
