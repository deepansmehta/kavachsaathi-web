import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import { requireOwnerSession } from "@/lib/patientEase/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CODE_TTL_MS = 10 * 60_000;

function hashCode(code: string, healthId: string): string {
  return createHash("sha256")
    .update(`${healthId}:${code}`)
    .digest("hex");
}

/**
 * POST /api/profile/hospital-consent
 * Owner generates a 6-digit one-time consent code (10 min, single use).
 */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("scanRegister");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;

  const db = getAdminDb();
  const ip = clientIp(req);
  const rl = await checkRateLimit({
    key: `hospital-consent:${sess.profileId}:${ip}`,
    limit: 10,
    windowMs: 60 * 60_000,
    captchaAfter: 99,
    db,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many consent codes. Try later." },
      { status: 429, headers: noStoreHeaders() }
    );
  }

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.collection("hospitalConsentCodes").doc(sess.healthId).set({
    healthId: sess.healthId,
    profileId: sess.profileId,
    codeHash: hashCode(code, sess.healthId),
    expiresAt: expiresAt.toISOString(),
    used: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    {
      success: true,
      code,
      expiresAt: expiresAt.toISOString(),
      expiresInSec: 600,
      note: "Share with hospital staff once. Valid 10 minutes. Single use.",
    },
    { headers: noStoreHeaders() }
  );
}

export { hashCode, CODE_TTL_MS };
