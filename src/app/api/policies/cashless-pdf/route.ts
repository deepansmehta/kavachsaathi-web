import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { hasEncKey } from "@/lib/crypto";
import { normalizePin, verifyPin } from "@/lib/pin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { readPoliciesFromProfile, toClientPolicy } from "@/lib/policy/cryptoPolicy";
import { buildCashlessInfoPdf } from "@/lib/policy/cashlessPdf";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EmergencyContact = { name?: string; phone?: string; relation?: string };

function formatContacts(data: Record<string, unknown>): string {
  const raw = Array.isArray(data.emergency_contacts)
    ? (data.emergency_contacts as EmergencyContact[])
    : [];
  return raw
    .map((c) => [c?.name, c?.phone].filter(Boolean).join(" — "))
    .filter(Boolean)
    .join("; ");
}

/**
 * POST /api/policies/cashless-pdf — PIN-gated download of the one-page
 * Cashless Info Sheet (pdf-lib). Full policy number appears only in the PDF
 * itself; never logged or echoed in JSON.
 * Body: { policyId, pin }
 */
export async function POST(req: NextRequest) {
  const flags = await requireFeature("policyWallet");
  if (!flags || !flags.cashlessPdf) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  if (!hasEncKey()) {
    return NextResponse.json(
      { error: "Encryption not configured" },
      { status: 503, headers: noStoreHeaders() }
    );
  }

  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }
  const data = snap.data() as Record<string, unknown>;

  const ip = clientIp(req);
  const rl = await checkRateLimit({
    key: `cashless-pdf:${sess.profileId}:${ip}`,
    limit: 10,
    windowMs: 60 * 60_000,
    captchaAfter: 99,
    db,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts — try again later" },
      { status: 429, headers: noStoreHeaders() }
    );
  }

  const body = await req.json().catch(() => ({}));
  const policyId = String(body.policyId || "").trim();
  const pin = normalizePin(body.pin);
  if (!policyId || !pin) {
    return NextResponse.json(
      { error: "policyId and pin required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const pinHash = data.pin_hash as string | undefined;
  const pinOk = await verifyPin(pin, pinHash);
  if (!pinOk) {
    return NextResponse.json(
      { error: "Incorrect PIN" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const policies = readPoliciesFromProfile(data);
  const stored = policies.find((p) => p.id === policyId);
  if (!stored) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const policy = toClientPolicy(stored);

  const { bytes } = await buildCashlessInfoPdf({
    holderName: String(data.full_name || data.name || ""),
    healthId: String(data.health_id || ""),
    bloodGroup: String(data.blood_group || data.bloodGroup || ""),
    insurerName: policy.insurerName || "",
    tpaName: policy.tpaName || "",
    policyNumber: policy.policyNumber || "",
    memberId: policy.memberId || "",
    sumInsured: policy.sumInsured || "",
    nomineeName: policy.nominee?.name || "",
    nomineeRelation: policy.nominee?.relation || "",
    nomineePhone: policy.nominee?.phone || "",
    emergencyContacts: formatContacts(data),
    cashlessHelpline: policy.cashlessHelpline || "",
    claimHelpline: policy.claimHelpline || "",
  });

  // Never log policy numbers / PINs — only a generic access marker.
  await db.collection("accessLogs").add({
    health_id: String(data.health_id || ""),
    mode: "cashless_pdf",
    at: new Date(),
  });

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="cashless-info-sheet.pdf"',
    },
  });
}
