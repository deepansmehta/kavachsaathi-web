import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { activateCardAtomic } from "@/lib/activateCard";
import {
  evaluateActivationGate,
  NO_STORE_HEADERS,
} from "@/lib/activationGate";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { normalizeHealthId } from "@/lib/healthId";
import {
  checkRateLimit,
  clientIp,
  makeMathCaptcha,
  verifyMathCaptcha,
} from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/card/activate
 * PIN + secret activation_code + atomic Firestore transaction.
 * No OTP.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getAdminDb();
    const ip = clientIp(req);

    const rl = await checkRateLimit({
      key: `card-activate:${ip}`,
      limit: 15,
      windowMs: 15 * 60_000,
      captchaAfter: 6,
      db,
    });

    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Try again later.",
          captchaRequired: true,
          captcha: makeMathCaptcha(),
          retryAfterSec: rl.retryAfterSec,
        },
        { status: 429 }
      );
    }

    if (rl.captchaRequired) {
      if (
        !verifyMathCaptcha(
          String(body.captchaToken || ""),
          String(body.captchaAnswer || "")
        )
      ) {
        return NextResponse.json(
          {
            error: "CAPTCHA required",
            captchaRequired: true,
            captcha: makeMathCaptcha(),
          },
          { status: 403 }
        );
      }
    }

    const health_id = normalizeHealthId(String(body.health_id || ""));
    const card = await findCardByHealthId(db, health_id);
    const gate = evaluateActivationGate(health_id, card?.isDemo === true);
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.message, code: gate.code },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const result = await activateCardAtomic(db, {
      health_id,
      activation_code: String(body.activation_code || ""),
      pin: String(body.pin || ""),
      full_name: String(body.full_name || body.name || ""),
      phone: String(body.phone || ""),
      blood_group: String(body.blood_group || ""),
      allergies: asArr(body.allergies),
      chronic_conditions: asArr(
        body.chronic_conditions ?? body.medical_conditions
      ),
      medications: asArr(body.medications ?? body.current_medications),
      emergency_contacts: Array.isArray(body.emergency_contacts)
        ? body.emergency_contacts
        : [],
      family_doctor: body.family_doctor || {
        name: body.doctor_name || body.familyDoctorName,
        phone: body.doctor_phone || body.familyDoctorPhone,
      },
      photo_url: body.photo_url || null,
      city: String(body.city || ""),
      fullAddress: body.fullAddress || null,
      organDonor: body.organDonor ?? body.organ_donor ?? "unset",
      preferredHospital: body.preferredHospital || null,
      familyDoctorName: body.familyDoctorName || null,
      familyDoctorPhone: body.familyDoctorPhone || null,
      criticalAlerts: body.criticalAlerts || { tags: [] },
      abhaId: body.abhaId || null,
      gender: body.gender || null,
      dateOfBirth: body.dateOfBirth || null,
      occupation: body.occupation || null,
      alternateContact: body.alternateContact || null,
      hasFamilyPhysician: body.hasFamilyPhysician ?? null,
      photoPath: body.photoPath || null,
      idProofs: body.idProofs || null,
      address: body.address || null,
      addressProof: body.addressProof || null,
      insurance: body.insurance || null,
      consents: body.consents || null,
      requireFullDocs: body.requireFullDocs !== false,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, missing: result.error.startsWith("Missing") ? result.error : undefined },
        { status: result.status }
      );
    }

    // Move pending uploads → profiles/{health_id}/ and patch paths
    try {
      const { finalizeActivationFiles } = await import("@/lib/activateCard");
      const { buildEncryptedDocFields, validateMandatoryDocs } = await import(
        "@/lib/documents"
      );
      const { isStorageConfigured } = await import("@/lib/storage");
      const { hasEncKey } = await import("@/lib/crypto");
      if (
        isStorageConfigured() &&
        hasEncKey() &&
        body.photoPath &&
        body.idProofs &&
        body.address &&
        body.insurance &&
        body.consents
      ) {
        const missing = validateMandatoryDocs({
          photoPath: body.photoPath,
          idProofs: body.idProofs,
          address: body.address,
          addressProof: body.addressProof,
          insurance: body.insurance,
          consents: body.consents,
        });
        if (!missing.length) {
          const fields = buildEncryptedDocFields({
            photoPath: body.photoPath,
            idProofs: body.idProofs,
            address: body.address,
            addressProof: body.addressProof,
            insurance: body.insurance,
            consents: body.consents,
          });
          await finalizeActivationFiles(result.health_id, fields);
          await db.collection("profiles").doc(result.profileId).update({
            photo: fields.photo,
            idProofs: fields.idProofs,
            addressProof: fields.addressProof,
            insurance: fields.insurance,
            profileComplete: true,
          });
        }
      }
    } catch (e) {
      console.error("finalizeActivationFiles", e);
    }

    return NextResponse.json({
      success: true,
      health_id: result.health_id,
      profileId: result.profileId,
      message: "Card activated. Your emergency profile is live.",
    });
  } catch (err) {
    console.error("POST /api/card/activate", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Activation failed" },
      { status: 500 }
    );
  }
}

function asArr(v: unknown): string[] {
  if (typeof v === "string") {
    return v
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}
