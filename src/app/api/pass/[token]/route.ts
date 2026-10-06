import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { requirePack2Feature } from "@/lib/patientEase/auth";
import {
  attendantWatermark,
  hashAttendantToken,
  isGuessableToken,
} from "@/lib/patientEase/attendantPass";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { token: string } };

export async function GET(req: NextRequest, ctx: Ctx) {
  const feat = await requirePack2Feature("attendantPass");
  if (!feat.ok) return feat.res;
  const token = String(ctx.params.token || "");
  if (isGuessableToken(token)) {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  const tokenHash = hashAttendantToken(token);
  const db = getAdminDb();
  const snap = await db
    .collection("attendant_passes")
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get();
  if (snap.empty) {
    return NextResponse.json(
      { error: "Pass not found", code: "GONE" },
      { status: 410, headers: noStoreHeaders() }
    );
  }
  const doc = snap.docs[0];
  const data = doc.data();
  if (data.revoked) {
    return NextResponse.json(
      { error: "Pass revoked", code: "REVOKED" },
      { status: 410, headers: noStoreHeaders() }
    );
  }
  if (Date.parse(String(data.validTill)) < Date.now()) {
    return NextResponse.json(
      { error: "Pass expired", code: "EXPIRED" },
      { status: 410, headers: noStoreHeaders() }
    );
  }

  await db.collection("attendant_pass_logs").add({
    passId: doc.id,
    profileId: data.profileId,
    at: new Date().toISOString(),
    ua: req.headers.get("user-agent") || "",
    created_at: FieldValue.serverTimestamp(),
  });

  const profile = await db.collection("profiles").doc(String(data.profileId)).get();
  if (!profile.exists) {
    return NextResponse.json({ error: "Profile missing" }, { status: 404 });
  }
  const p = profile.data()!;
  let docs: unknown = null;
  if (data.includeIds && p.documents_enc) {
    try {
      docs = JSON.parse(decrypt(String(p.documents_enc)));
    } catch {
      docs = null;
    }
  }

  const watermark = attendantWatermark(
    String(data.attendantName || "Attendant"),
    String(data.validTill)
  );

  return NextResponse.json(
    {
      scope: "attendant",
      watermark,
      validTill: data.validTill,
      attendantName: data.attendantName,
      full_name: p.full_name,
      blood_group: p.blood_group,
      allergies: p.allergies || [],
      chronic_conditions: p.chronic_conditions || [],
      medications: p.medications || [],
      emergency_contacts: p.emergency_contacts || [],
      family_doctor: p.family_doctor || null,
      // IDs only when owner opted in
      idProofs: data.includeIds
        ? (docs as { idProofs?: unknown })?.idProofs || null
        : null,
      includeIds: !!data.includeIds,
    },
    { headers: noStoreHeaders() }
  );
}
