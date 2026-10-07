/**
 * POST /api/need-blood
 *   body: { hospital: string, phone?: string }
 *   → { waUrl: string, eRaktKoshUrl: string }
 *   Builds a WhatsApp help message; logs need_blood_events; NO location stored.
 *   Auth: profile session (blood group already on profile — NEVER from emergency).
 *
 * GET  /api/need-blood (public — returns only eRaktKosh URL for emergency card link)
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { waMeLink, COMPANY_WHATSAPP } from "@/lib/config/links";
import { E_RAKT_KOSH } from "@/lib/patientEase/officialLinks";
import {
  FULL_DETAILS_COOKIE,
  verifyFullDetailsToken,
} from "@/lib/fullDetailsSession";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public GET — returns only the eRaktKosh URL. */
export async function GET() {
  const flags = await requireFeature("needBlood");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  return NextResponse.json(
    { eRaktKoshUrl: E_RAKT_KOSH.url },
    { headers: noStoreHeaders() }
  );
}

export async function POST(req: NextRequest) {
  const flags = await requireFeature("needBlood");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  let profileId: string | null = null;
  let bloodGroup = "";
  let healthId = "";

  // Allow PIN full-details session too
  const fdToken = req.cookies.get(FULL_DETAILS_COOKIE)?.value;
  const fdSess = verifyFullDetailsToken(fdToken);
  if (fdSess?.scope === "pin") {
    const q = await db
      .collection("profiles")
      .where("health_id", "==", fdSess.healthId)
      .limit(1)
      .get();
    if (!q.empty) {
      profileId = q.docs[0].id;
      const d = q.docs[0].data();
      bloodGroup = String(d.blood_group || "");
      healthId = String(d.health_id || "");
    }
  }

  if (!profileId) {
    const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
    const sess = verifyProfileSessionToken(tok);
    if (!sess) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders() }
      );
    }
    const snap = await db.collection("profiles").doc(sess.profileId).get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders() }
      );
    }
    profileId = sess.profileId;
    const d = snap.data()!;
    bloodGroup = String(d.blood_group || "");
    healthId = String(d.health_id || "");
  }

  const body = await req.json();
  const hospital = String(body.hospital || "").trim();
  const phone = String(body.phone || "").replace(/\D/g, "").slice(0, 10);

  if (!hospital) {
    return NextResponse.json(
      { error: "hospital name is required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  // Build WhatsApp message (goes to KavachSaathi helpline for routing)
  const bgDisplay = bloodGroup ? ` (Blood Group: ${bloodGroup})` : "";
  const phoneStr = phone ? `\nContact: +91 ${phone}` : "";
  const msg = `🩸 Blood needed urgently!\n\nHospital: ${hospital}${bgDisplay}${phoneStr}\n\nKavachSaathi Health ID: ${healthId}\n\nPlease help locate blood / contact blood bank.`;

  const waUrl = waMeLink(msg, COMPANY_WHATSAPP);

  // Log event (NO location, NO PHI beyond blood group already public)
  await db.collection("need_blood_events").add({
    profileId,
    healthId: healthId || null,
    bloodGroup: bloodGroup || null,
    hospital,
    hasContactPhone: Boolean(phone),
    at: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    { waUrl, eRaktKoshUrl: E_RAKT_KOSH.url },
    { headers: noStoreHeaders() }
  );
}
