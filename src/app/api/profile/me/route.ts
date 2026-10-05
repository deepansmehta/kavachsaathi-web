import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
  clearProfileSessionCookie,
} from "@/lib/profileSession";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { normalizeCardStatus } from "@/lib/healthId";
import {
  parseCriticalAlerts,
  parseOrganDonor,
} from "@/lib/profileFields";

import { decrypt, hasEncKey } from "@/lib/crypto";

function safeDec(enc: unknown): string {
  if (!enc || typeof enc !== "string" || !hasEncKey()) return "";
  try {
    return decrypt(enc);
  } catch {
    return "";
  }
}

/** Owner-facing insurance edit payload (decrypted ID-like fields for form editing). */
function redactInsuranceForProfile(insurance: unknown) {
  if (!insurance || typeof insurance !== "object") return null;
  const i = insurance as {
    coverageType?: string;
    private?: Record<string, unknown>;
    government?: Record<string, unknown>;
    otherMediclaim?: Record<string, unknown>;
  };
  const priv = i.private || {};
  const gov = i.government || {};
  const om = i.otherMediclaim || {};
  return {
    coverageType: i.coverageType || "",
    private: {
      insurerName: priv.insurerName || "",
      policyNumber: safeDec(priv.policyNumberEnc),
      policyHolderName: priv.policyHolderName || "",
      validTill: priv.validTill || "",
      tpaName: priv.tpaName || "",
      memberId: safeDec(priv.memberIdEnc),
      isGroupPolicy: Boolean(priv.isGroupPolicy),
      corporateName: priv.corporateName || "",
      employeeId: safeDec(priv.employeeIdEnc),
    },
    government: {
      schemeName: gov.schemeName || "",
      govtCardNumber: safeDec(gov.govtCardNumberEnc),
    },
    otherMediclaim: {
      hasOther: Boolean(om.hasOther),
      companyName: om.companyName || "",
      policyNumber: safeDec(om.policyNumberEnc),
    },
  };
}


/** GET /api/profile/me — current session profile (editable fields, no pin_hash) */
export async function GET() {
  try {
    const token = cookies().get(PROFILE_SESSION_COOKIE)?.value;
    const session = verifyProfileSessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const db = getAdminDb();
    const snap = await db.collection("profiles").doc(session.profileId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const data = snap.data()!;
    const health_id = String(data.health_id || "");
    const card = health_id ? await findCardByHealthId(db, health_id) : null;
    const fd =
      data.family_doctor && typeof data.family_doctor === "object"
        ? (data.family_doctor as { name?: string; phone?: string })
        : null;

    return NextResponse.json({
      profile: {
        id: snap.id,
        health_id,
        full_name: data.full_name,
        phone: data.phone,
        blood_group: data.blood_group,
        allergies: data.allergies || [],
        chronic_conditions: data.chronic_conditions || [],
        medications: data.medications || [],
        emergency_contacts: data.emergency_contacts || [],
        family_doctor: data.family_doctor || null,
        familyDoctorName:
          data.familyDoctorName || fd?.name || data.doctor_name || "",
        familyDoctorPhone:
          data.familyDoctorPhone || fd?.phone || data.doctor_phone || "",
        photo_url: data.photo_url || null,
        city: data.city || "",
        fullAddress: data.fullAddress || "",
        organDonor: parseOrganDonor(data.organDonor ?? data.organ_donor),
        preferredHospital: data.preferredHospital || "",
        criticalAlerts: parseCriticalAlerts(data.criticalAlerts),
        abhaId: data.abhaId || "",
        gender: data.gender || "",
        dateOfBirth: data.dateOfBirth || "",
        occupation: data.occupation || "",
        alternateContact: data.alternateContact || "",
        hasFamilyPhysician:
          data.hasFamilyPhysician === true || data.hasFamilyPhysician === false
            ? data.hasFamilyPhysician
            : null,
        insurance: redactInsuranceForProfile(data.insurance),
        cardStatus: card ? normalizeCardStatus(card.status) : "unactivated",
        validTill: card?.validTill || null,
        lastSeenScansAt: data.lastSeenScansAt?.toDate?.()?.toISOString?.() || null,
      },
    });
  } catch (err) {
    console.error("profile/me", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/profile/me — logout */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  const c = clearProfileSessionCookie();
  res.cookies.set(c.name, c.value, c);
  return res;
}

/** Logout alias */
export async function POST() {
  return DELETE();
}
