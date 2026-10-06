import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { requirePack2Feature } from "@/lib/patientEase/auth";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { normalizeHealthId } from "@/lib/healthId";
import {
  firstNameOnly,
  needBloodWaMessage,
} from "@/lib/patientEase/helpers";
import { waMeLink, COMPANY_WHATSAPP } from "@/lib/config/links";
import { E_RAKTKOSH_URL } from "@/lib/patientEase/officialLinks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/need-blood
 * Public for emergency card: builds wa.me message. Does NOT store location.
 * Logs only health_id + blood group + timestamp (no hospital GPS).
 */
export async function POST(req: NextRequest) {
  const feat = await requirePack2Feature("needBlood");
  if (!feat.ok) return feat.res;
  const body = await req.json().catch(() => ({}));
  const healthId = normalizeHealthId(String(body.health_id || ""));
  const hospital = String(body.hospital || "").trim().slice(0, 120);
  if (!healthId || !hospital) {
    return NextResponse.json(
      { error: "health_id and hospital required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  const db = getAdminDb();
  const card = await findCardByHealthId(db, healthId);
  if (!card?.linkedProfileId) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  const profile = await db.collection("profiles").doc(card.linkedProfileId).get();
  if (!profile.exists) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  const p = profile.data()!;
  const bloodGroup = String(p.blood_group || body.blood_group || "").trim();
  if (!bloodGroup) {
    return NextResponse.json(
      { error: "Blood group not on profile" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  const contacts = Array.isArray(p.emergency_contacts)
    ? p.emergency_contacts
    : [];
  const phone =
    String(body.phone || "").replace(/\D/g, "").slice(-10) ||
    String(contacts[0]?.phone || "").replace(/\D/g, "").slice(-10) ||
    COMPANY_WHATSAPP.slice(-10);
  const msg = needBloodWaMessage({
    bloodGroup,
    firstName: firstNameOnly(String(p.full_name || "")),
    hospital,
    phone,
  });
  await db.collection("need_blood_events").add({
    health_id: healthId,
    blood_group: bloodGroup,
    // hospital typed by user for the message only — intentionally NOT stored
    at: new Date().toISOString(),
    created_at: FieldValue.serverTimestamp(),
  });
  return NextResponse.json(
    {
      message: msg,
      whatsappUrl: waMeLink(msg),
      eRaktKoshUrl: E_RAKTKOSH_URL,
      bloodGroup,
    },
    { headers: noStoreHeaders() }
  );
}
