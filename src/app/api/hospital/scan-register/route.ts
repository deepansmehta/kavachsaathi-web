import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { verifyPin } from "@/lib/pin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { loadEmergencyProfile } from "@/lib/cardsRepo";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { buildFhirPatientResource } from "@/lib/fhir/buildBundle";
import { ageFromDob } from "@/lib/forms/pdfCommon";
import {
  HOSPITAL_SESSION_COOKIE,
  verifyHospitalSessionToken,
} from "../login/route";
import { hashCode } from "../../profile/hospital-consent/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACCESS_TTL_MS = 15 * 60_000;

function getSession(req: NextRequest) {
  const tok = req.cookies.get(HOSPITAL_SESSION_COOKIE)?.value;
  return verifyHospitalSessionToken(tok);
}

function parseHealthId(raw: string): string {
  const s = String(raw || "").trim();
  const m = s.match(/KVS-[A-Z0-9-]+/i);
  if (m) return m[0].toUpperCase();
  try {
    const u = new URL(s);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "card" || p === "emergency");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].toUpperCase();
  } catch {
    /* */
  }
  return s.toUpperCase();
}

function limitedPanel(profile: {
  name: string;
  blood_group: string;
  allergies: string[];
  chronic_conditions: string[];
  medications: string[];
  emergency_contacts: { name: string; phone: string; relation?: string }[];
}) {
  return {
    scope: "emergency_limited" as const,
    fullName: profile.name,
    bloodGroup: profile.blood_group,
    allergies: profile.allergies,
    conditions: profile.chronic_conditions,
    medicines: profile.medications,
    emergencyContacts: profile.emergency_contacts,
    // Explicitly omitted: address, IDs, insurance, ABHA, DOB details beyond public
  };
}

function fullPanel(d: Record<string, unknown>) {
  const insurance = (d.insurance || {}) as {
    private?: {
      insurerName?: string;
      policyNumber?: string;
      memberId?: string;
      tpaName?: string;
    };
    government?: { schemeName?: string; cardNumber?: string };
  };
  const dob = String(d.dateOfBirth || "");
  const ageObj = dob ? ageFromDob(dob) : { years: "", months: "" };
  const age = ageObj.years ? Number(ageObj.years) : null;
  return {
    scope: "full_registration" as const,
    fullName: String(d.full_name || ""),
    age,
    dateOfBirth: dob || null,
    gender: String(d.gender || "") || null,
    phone: String(d.phone || "") || null,
    address: String(d.address || "") || null,
    city: String(d.city || "") || null,
    bloodGroup: String(d.blood_group || "") || null,
    allergies: Array.isArray(d.allergies) ? d.allergies : [],
    abhaNumber: String(d.abhaId || "") || null,
    insurer: insurance.private?.insurerName || null,
    tpa: insurance.private?.tpaName || null,
    policyNumber: insurance.private?.policyNumber || null,
    memberId: insurance.private?.memberId || null,
    governmentScheme: insurance.government?.schemeName || null,
    schemeCardNumber: insurance.government?.cardNumber || null,
    // No ID-proof images
  };
}

/**
 * POST /api/hospital/scan-register
 * Verified hospital staff only.
 * body: { cardUrl|healthId, consent: "none"|"pin"|"code", pin?, code? }
 */
export async function POST(req: NextRequest) {
  const portal = await requireFeature("hospitalPortal");
  if (!portal) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const feature = await requireFeature("scanRegister");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const session = getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const hospitalSnap = await db.collection("hospitals").doc(session.hospitalId).get();
  if (!hospitalSnap.exists) {
    return NextResponse.json(
      { error: "Hospital not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const hospital = hospitalSnap.data()!;
  if (hospital.verified !== true) {
    return NextResponse.json(
      { error: "Hospital not verified", code: "UNVERIFIED" },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const body = await req.json().catch(() => ({}));
  const healthId = parseHealthId(
    String(
      (body as { healthId?: string; cardUrl?: string }).healthId ||
        (body as { cardUrl?: string }).cardUrl ||
        ""
    )
  );
  if (!healthId) {
    return NextResponse.json(
      { error: "cardUrl or healthId required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const consent = String((body as { consent?: string }).consent || "none");
  const pin = String((body as { pin?: string }).pin || "");
  const code = String((body as { code?: string }).code || "").replace(/\D/g, "");

  const ip = clientIp(req);
  const rl = await checkRateLimit({
    key: `scan-register:${session.hospitalId}:${ip}`,
    limit: 60,
    windowMs: 60 * 60_000,
    captchaAfter: 99,
    db,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: noStoreHeaders() }
    );
  }

  const card = await findCardByHealthId(db, healthId);
  if (!card) {
    return NextResponse.json(
      { error: "Card not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const publicProfile = await loadEmergencyProfile(db, card);
  if (!publicProfile) {
    return NextResponse.json(
      { error: "No emergency profile (unactivated or blocked)" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  let grantedFull = false;
  let profileId = card.linkedProfileId || "";

  if (consent === "pin" && pin) {
    if (!profileId) {
      return NextResponse.json(
        { error: "Profile not linked" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    const snap = await db.collection("profiles").doc(profileId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404, headers: noStoreHeaders() });
    }
    const ok = await verifyPin(pin, String(snap.data()?.pin_hash || ""));
    if (!ok) {
      return NextResponse.json(
        { error: "Incorrect PIN" },
        { status: 401, headers: noStoreHeaders() }
      );
    }
    grantedFull = true;
  } else if (consent === "code" && code.length === 6) {
    const consRef = db.collection("hospitalConsentCodes").doc(healthId);
    const consSnap = await consRef.get();
    if (!consSnap.exists) {
      return NextResponse.json(
        { error: "Consent code not found or expired" },
        { status: 401, headers: noStoreHeaders() }
      );
    }
    const c = consSnap.data()!;
    if (c.used === true) {
      return NextResponse.json(
        { error: "Consent code already used" },
        { status: 401, headers: noStoreHeaders() }
      );
    }
    if (new Date(String(c.expiresAt)).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Consent code expired" },
        { status: 401, headers: noStoreHeaders() }
      );
    }
    if (c.codeHash !== hashCode(code, healthId)) {
      return NextResponse.json(
        { error: "Invalid consent code" },
        { status: 401, headers: noStoreHeaders() }
      );
    }
    await consRef.update({ used: true, usedAt: FieldValue.serverTimestamp() });
    profileId = String(c.profileId || profileId);
    grantedFull = true;
  }

  const expiresAt = new Date(Date.now() + ACCESS_TTL_MS).toISOString();
  let panel: Record<string, unknown>;
  let fhirPatient: Record<string, unknown> | null = null;

  if (grantedFull && profileId) {
    const snap = await db.collection("profiles").doc(profileId).get();
    const d = snap.data() || {};
    panel = fullPanel(d as Record<string, unknown>);
    fhirPatient = buildFhirPatientResource({
      health_id: healthId,
      full_name: String(d.full_name || ""),
      gender: d.gender as string,
      dateOfBirth: d.dateOfBirth as string,
      phone: d.phone as string,
      address: d.address as string,
      city: d.city as string,
      abhaId: d.abhaId as string,
      blood_group: d.blood_group as string,
      allergies: d.allergies as string[],
      insurance: d.insurance as never,
    });
  } else {
    panel = limitedPanel(publicProfile);
  }

  await db.collection("accessLogs").add({
    health_id: healthId,
    healthId,
    mode: grantedFull ? "scan_register_full" : "scan_register_limited",
    at: FieldValue.serverTimestamp(),
    hospitalId: session.hospitalId,
    hospitalName: hospital.name || null,
    staffEmail: session.email,
    staffVerified: true,
    expiresAt,
    profileId: profileId || null,
  });

  await db
    .collection("hospitals")
    .doc(session.hospitalId)
    .set(
      {
        scanRegisterCount: FieldValue.increment(1),
        lastScanRegisterAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  // Session token for 15-min access window (client holds expiresAt)
  const accessToken = createHash("sha256")
    .update(
      `${session.hospitalId}:${session.email}:${healthId}:${expiresAt}:${grantedFull}`
    )
    .digest("hex")
    .slice(0, 32);

  await db.collection("hospitalScanSessions").doc(accessToken).set({
    hospitalId: session.hospitalId,
    staffEmail: session.email,
    healthId,
    profileId: profileId || null,
    full: grantedFull,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    {
      success: true,
      healthId,
      consent: grantedFull ? consent : "none",
      expiresAt,
      accessToken,
      panel,
      fhirPatient,
      csv: panelToCsv(panel),
      tabSeparated: panelToTsv(panel),
    },
    { headers: noStoreHeaders() }
  );
}

/** GET — refresh panel if accessToken still valid */
export async function GET(req: NextRequest) {
  const portal = await requireFeature("hospitalPortal");
  if (!portal) {
    return NextResponse.json(
      { error: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const feature = await requireFeature("scanRegister");
  if (!feature) {
    return NextResponse.json(
      { error: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders() });
  }
  const token = req.nextUrl.searchParams.get("accessToken") || "";
  if (!token) {
    return NextResponse.json({ error: "accessToken required" }, { status: 400, headers: noStoreHeaders() });
  }
  const db = getAdminDb();
  const snap = await db.collection("hospitalScanSessions").doc(token).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404, headers: noStoreHeaders() });
  }
  const s = snap.data()!;
  if (s.hospitalId !== session.hospitalId || s.staffEmail !== session.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStoreHeaders() });
  }
  if (new Date(String(s.expiresAt)).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Access expired", code: "EXPIRED" },
      { status: 410, headers: noStoreHeaders() }
    );
  }
  return NextResponse.json(
    { success: true, expiresAt: s.expiresAt, healthId: s.healthId, full: s.full === true },
    { headers: noStoreHeaders() }
  );
}

function panelToTsv(panel: Record<string, unknown>): string {
  const keys = Object.keys(panel).filter((k) => k !== "scope");
  const vals = keys.map((k) => {
    const v = panel[k];
    if (Array.isArray(v)) return v.join("; ");
    return v == null ? "" : String(v);
  });
  return `${keys.join("\t")}\n${vals.join("\t")}`;
}

function panelToCsv(panel: Record<string, unknown>): string {
  const keys = Object.keys(panel).filter((k) => k !== "scope");
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const vals = keys.map((k) => {
    const v = panel[k];
    if (Array.isArray(v)) return esc(v.join("; "));
    return esc(v == null ? "" : String(v));
  });
  return `${keys.map(esc).join(",")}\n${vals.join(",")}`;
}
