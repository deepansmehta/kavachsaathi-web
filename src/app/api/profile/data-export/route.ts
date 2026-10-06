import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyPin } from "@/lib/pin";
import { getSignedGetUrl, isStorageConfigured } from "@/lib/storage";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { trackAgg } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIGNED_TTL_MS = 10 * 60_000;

function maskAadhaarLast4(last4?: string | null): string {
  const l = String(last4 || "").replace(/\D/g, "").slice(-4);
  return l ? `XXXX XXXX ${l}` : "XXXX XXXX ****";
}

async function buildSummaryPdf(data: {
  health_id: string;
  full_name: string;
  phone: string;
  blood_group: string;
  city: string;
  allergies: string[];
  chronic_conditions: string[];
  medications: string[];
  exportedAt: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const draw = (text: string, size = 11, useBold = false) => {
    page.drawText(text.slice(0, 90), {
      x: 48,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.1, 0.1, 0.12),
    });
    y -= size + 8;
  };
  draw("KavachSaathi — My Data Export", 16, true);
  draw(`Exported: ${data.exportedAt}`, 10);
  draw(`Health ID: ${data.health_id}`, 11, true);
  draw(`Name: ${data.full_name}`);
  draw(`Phone: ${data.phone}`);
  draw(`Blood group: ${data.blood_group}`);
  draw(`City: ${data.city}`);
  draw(`Allergies: ${data.allergies.join(", ") || "None"}`);
  draw(`Conditions: ${data.chronic_conditions.join(", ") || "None"}`);
  draw(`Medications: ${data.medications.join(", ") || "None"}`);
  y -= 12;
  draw("Aadhaar numbers are masked. Document links expire in 10 minutes.", 9);
  draw("This is a personal copy — handle securely.", 9);
  return doc.save();
}

/**
 * POST /api/profile/data-export
 * PIN re-verify, rate limit 3/day, JSON + PDF summary + signed doc links (10 min).
 */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("dataExport");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  try {
    const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
    const sess = verifyProfileSessionToken(tok);
    if (!sess) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const body = await req.json();
    const pin = String(body.pin || "");
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: "Re-enter your PIN (4–6 digits)" },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const db = getAdminDb();
    const ip = clientIp(req);
    const rl = await checkRateLimit({
      key: `data-export:${sess.profileId}:${ip}`,
      limit: 3,
      windowMs: 24 * 60 * 60_000,
      captchaAfter: 99,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Export limit reached (3 per day). Try again tomorrow." },
        { status: 429, headers: noStoreHeaders() }
      );
    }

    const snap = await db.collection("profiles").doc(sess.profileId).get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    const d = snap.data()!;
    const ok = await verifyPin(pin, String(d.pin_hash || ""));
    if (!ok) {
      return NextResponse.json(
        { error: "Incorrect PIN" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const health_id = String(d.health_id || "");
    const exportedAt = new Date().toISOString();

    const idProofs = Array.isArray(d.idProofs)
      ? await Promise.all(
          (d.idProofs as {
            type?: string;
            last4?: string;
            frontPath?: string;
            backPath?: string;
          }[]).map(async (id) => {
            const type = String(id.type || "");
            const numberMasked =
              type === "aadhaar"
                ? maskAadhaarLast4(id.last4)
                : id.last4
                  ? `****${id.last4}`
                  : null;
            let frontUrl: string | null = null;
            let backUrl: string | null = null;
            if (isStorageConfigured()) {
              try {
                if (id.frontPath) {
                  frontUrl = await getSignedGetUrl({
                    path: id.frontPath,
                    expiresMs: SIGNED_TTL_MS,
                  });
                }
                if (id.backPath) {
                  backUrl = await getSignedGetUrl({
                    path: id.backPath,
                    expiresMs: SIGNED_TTL_MS,
                  });
                }
              } catch {
                /* optional */
              }
            }
            return {
              type,
              numberMasked,
              frontUrl,
              backUrl,
              expiresInSec: 600,
            };
          })
        )
      : [];

    let photoUrl: string | null = null;
    const photoPath =
      (d.photo as { path?: string } | undefined)?.path ||
      (typeof d.photo_url === "string" && d.photo_url.includes("/")
        ? d.photo_url
        : null);
    if (photoPath && isStorageConfigured() && !String(photoPath).startsWith("http")) {
      try {
        photoUrl = await getSignedGetUrl({
          path: String(photoPath),
          expiresMs: SIGNED_TTL_MS,
        });
      } catch {
        photoUrl = null;
      }
    }

    const exportJson = {
      exportedAt,
      health_id,
      full_name: String(d.full_name || ""),
      phone: String(d.phone || ""),
      blood_group: String(d.blood_group || ""),
      city: String(d.city || ""),
      allergies: Array.isArray(d.allergies) ? d.allergies : [],
      chronic_conditions: Array.isArray(d.chronic_conditions)
        ? d.chronic_conditions
        : [],
      medications: Array.isArray(d.medications) ? d.medications : [],
      emergency_contacts: d.emergency_contacts || [],
      family_doctor: d.family_doctor || null,
      organDonor: d.organDonor || "unset",
      preferredHospital: d.preferredHospital || null,
      abhaId: d.abhaId || null,
      validFrom: d.validFrom || null,
      validTill: d.validTill || null,
      photoUrl,
      idProofs,
      note: "Aadhaar masked. Signed document URLs expire in 10 minutes.",
    };

    const pdfBytes = await buildSummaryPdf({
      health_id,
      full_name: exportJson.full_name,
      phone: exportJson.phone,
      blood_group: exportJson.blood_group,
      city: exportJson.city,
      allergies: exportJson.allergies as string[],
      chronic_conditions: exportJson.chronic_conditions as string[],
      medications: exportJson.medications as string[],
      exportedAt,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    await db.collection("accessLogs").add({
      health_id,
      healthId: health_id,
      mode: "data_export",
      at: FieldValue.serverTimestamp(),
      profileId: sess.profileId,
    });
    trackAgg({ type: "data_export", city: exportJson.city || null });

    return NextResponse.json(
      {
        success: true,
        export: exportJson,
        pdfBase64,
        pdfContentType: "application/pdf",
        pdfFilename: `kavachsaathi-export-${health_id}.pdf`,
      },
      { headers: noStoreHeaders() }
    );
  } catch (err) {
    console.error("data-export", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
