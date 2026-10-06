import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { normalizeHealthId, isValidHealthId } from "@/lib/healthId";
import { normalizePin, verifyPin } from "@/lib/pin";
import { decrypt, hasEncKey } from "@/lib/crypto";
import { getSignedGetUrl, isStorageConfigured } from "@/lib/storage";
import {
  makeFullDetailsToken,
  fullDetailsCookieOptions,
  verifyFullDetailsToken,
  FULL_DETAILS_COOKIE,
  type FullDetailsScope,
} from "@/lib/fullDetailsSession";
import {
  checkRateLimit,
  clientIp,
  makeMathCaptcha,
  verifyMathCaptcha,
} from "@/lib/rateLimit";
import { computeValidity, pastGraceResponseBody } from "@/lib/validity";
import { loadFeatureFlags } from "@/lib/features/server";

async function loadProfile(health_id: string) {
  const db = getAdminDb();
  const card = await findCardByHealthId(db, health_id);
  if (!card?.linkedProfileId) {
    const q = await db
      .collection("profiles")
      .where("health_id", "==", health_id)
      .limit(1)
      .get();
    if (q.empty) return null;
    return { profileId: q.docs[0].id, data: q.docs[0].data(), card };
  }
  const snap = await db.collection("profiles").doc(card.linkedProfileId).get();
  if (!snap.exists) return null;
  return { profileId: snap.id, data: snap.data()!, card };
}

async function signed(path: string | null | undefined) {
  if (!path || !isStorageConfigured()) return null;
  try {
    return await getSignedGetUrl({
      path,
      expiresMs: Number(process.env.FULL_DETAILS_URL_TTL_MS || 5 * 60_000),
    });
  } catch {
    return null;
  }
}

function safeDecrypt(enc: unknown): string | null {
  if (!enc || typeof enc !== "string") return null;
  if (!hasEncKey()) return null;
  try {
    return decrypt(enc);
  } catch {
    return null;
  }
}

async function writeAccessLog(opts: {
  health_id: string;
  mode: FullDetailsScope | "admin";
  hospitalName?: string;
  staffName?: string;
  role?: string;
  mobile?: string;
  reason?: string;
  ip: string;
  ua: string;
}) {
  const db = getAdminDb();
  await db.collection("accessLogs").add({
    health_id: opts.health_id,
    healthId: opts.health_id,
    mode: opts.mode,
    hospitalName: opts.hospitalName || null,
    staffName: opts.staffName || null,
    role: opts.role || null,
    mobileMasked: opts.mobile
      ? `+91 XXXXXX${opts.mobile.replace(/\D/g, "").slice(-4)}`
      : null,
    reason: opts.reason || null,
    ipHash: createHash("sha256").update(opts.ip).digest("hex").slice(0, 16),
    userAgent: opts.ua.slice(0, 200),
    at: FieldValue.serverTimestamp(),
  });
}

/** POST — unlock with PIN or hospital emergency form */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = String(body.mode || "") as FullDetailsScope;
    const health_id = normalizeHealthId(String(body.health_id || ""));
    if (!isValidHealthId(health_id) || (mode !== "pin" && mode !== "emergency")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const db = getAdminDb();
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent") || "";

    if (mode === "pin") {
      const rl = await checkRateLimit({
        key: `full-details-pin:${ip}:${health_id}`,
        limit: 5,
        windowMs: 5 * 60_000,
        captchaAfter: 3,
        db,
        record: false,
      });
      if (!rl.allowed) {
        return NextResponse.json(
          {
            error: "Too many failed attempts",
            code: "RATE_LIMITED",
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
              code: "CAPTCHA_REQUIRED",
              captchaRequired: true,
              captcha: makeMathCaptcha(),
            },
            { status: 403 }
          );
        }
      }

      const found = await loadProfile(health_id);
      if (!found) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      {
        const flags = await loadFeatureFlags().catch(() => null);
        if (flags?.cardValidity) {
          const v = computeValidity({
            validFrom: found.card?.validFrom || found.card?.activated_at,
            validTill: found.card?.validTill,
            activatedAt: found.card?.activated_at,
          });
          if (v.ownerFeaturesLocked) {
            return NextResponse.json(pastGraceResponseBody(), { status: 403 });
          }
        }
      }
      const pin = normalizePin(body.pin);
      const ok = await verifyPin(pin, String(found.data.pin_hash || ""));
      if (!ok) {
        const hit = await checkRateLimit({
          key: `full-details-pin:${ip}:${health_id}`,
          limit: 5,
          windowMs: 5 * 60_000,
          captchaAfter: 3,
          db,
          record: true,
        });
        return NextResponse.json(
          {
            error: "Incorrect PIN",
            code: "INVALID_CREDENTIALS",
            attemptsLeft: hit.remaining,
            ...(hit.captchaRequired
              ? { captchaRequired: true, captcha: makeMathCaptcha() }
              : {}),
          },
          { status: 401 }
        );
      }

      await writeAccessLog({
        health_id,
        mode: "pin",
        ip,
        ua,
      });

      const token = makeFullDetailsToken(health_id, "pin");
      const res = NextResponse.json({ success: true, scope: "pin" });
      const cookie = fullDetailsCookieOptions(token);
      res.cookies.set(cookie.name, cookie.value, cookie);
      return res;
    }

    // emergency hospital access
    const rl = await checkRateLimit({
      key: `full-details-emg:${ip}:${health_id}`,
      limit: 3,
      windowMs: 60 * 60_000,
      captchaAfter: 99,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many emergency access attempts", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const hospitalName = String(body.hospitalName || "").trim();
    const staffName = String(body.staffName || "").trim();
    const role = String(body.role || "").trim();
    const mobile = String(body.mobile || "").replace(/\D/g, "").slice(-10);
    const reason = String(body.reason || "").trim();
    const attested = Boolean(body.attested);
    if (
      hospitalName.length < 2 ||
      staffName.length < 2 ||
      role.length < 2 ||
      !/^[6-9]\d{9}$/.test(mobile) ||
      reason.length < 3 ||
      !attested
    ) {
      return NextResponse.json(
        { error: "Complete all hospital emergency fields and attestation" },
        { status: 400 }
      );
    }

    const found = await loadProfile(health_id);
    if (!found) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await writeAccessLog({
      health_id,
      mode: "emergency",
      hospitalName,
      staffName,
      role,
      mobile,
      reason,
      ip,
      ua,
    });

    const token = makeFullDetailsToken(health_id, "emergency");
    const res = NextResponse.json({ success: true, scope: "emergency" });
    const cookie = fullDetailsCookieOptions(token);
    res.cookies.set(cookie.name, cookie.value, cookie);
    return res;
  } catch (err) {
    console.error("full-details POST", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

/** GET — return scoped full details for active session */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(FULL_DETAILS_COOKIE)?.value;
    const session = verifyFullDetailsToken(token);
    if (!session) {
      return NextResponse.json(
        { error: "Session expired", code: "SESSION_EXPIRED" },
        { status: 401 }
      );
    }

    const found = await loadProfile(session.healthId);
    if (!found) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const d = found.data;
    const photoPath = (d.photo as { path?: string } | undefined)?.path;
    const photoUrl = await signed(photoPath);

    const insurance = d.insurance as {
      coverageType?: string;
      private?: {
        insurerName?: string;
        policyNumberEnc?: string;
        policyHolderName?: string;
        validTill?: string;
        policyCardPath?: string;
        policyBondPath?: string;
      };
      government?: {
        schemeName?: string;
        govtCardNumberEnc?: string;
        govtCardPath?: string;
      };
    } | undefined;

    const base = {
      health_id: session.healthId,
      scope: session.scope,
      expiresAt: session.exp,
      full_name: d.full_name,
      photoUrl,
      blood_group: d.blood_group,
      watermark: `KavachSaathi · viewed ${new Date().toLocaleString("en-IN")}`,
    };

    if (session.scope === "emergency") {
      return NextResponse.json({
        ...base,
        city: (d.address as { city?: string } | undefined)?.city || d.city,
        district: (d.address as { district?: string } | undefined)?.district,
        insurance: {
          coverageType: insurance?.coverageType,
          insurerName: insurance?.private?.insurerName,
          policyNumber: safeDecrypt(insurance?.private?.policyNumberEnc),
          policyHolderName: insurance?.private?.policyHolderName,
          policyCardUrl: await signed(insurance?.private?.policyCardPath),
          schemeName: insurance?.government?.schemeName,
          govtCardNumber: safeDecrypt(insurance?.government?.govtCardNumberEnc),
          govtCardUrl: await signed(insurance?.government?.govtCardPath),
        },
        note: "ID & address proofs need the patient's / family's PIN.",
      });
    }

    // full PIN scope
    const idProofs = Array.isArray(d.idProofs) ? d.idProofs : [];
    const idsOut = [];
    for (const raw of idProofs) {
      const id = raw as {
        type?: string;
        numberEnc?: string | null;
        last4?: string;
        frontPath?: string;
        backPath?: string;
      };
      const number =
        id.type === "aadhaar"
          ? `XXXX XXXX ${id.last4 || "****"}`
          : safeDecrypt(id.numberEnc);
      idsOut.push({
        type: id.type,
        number,
        frontUrl: await signed(id.frontPath),
        backUrl: await signed(id.backPath),
      });
    }

    const addr = d.address as
      | {
          lineEnc?: string;
          city?: string;
          district?: string;
          state?: string;
          pincode?: string;
        }
      | undefined;
    const ap = d.addressProof as
      | { sameAsIdIndex?: number | null; path?: string | null }
      | undefined;

    // F8: ABHA — decrypt and include in PIN scope (never emergency)
    const abhaIdEnc = d.abhaIdEnc as string | undefined;
    const abhaIdPlain = d.abhaId as string | undefined;
    let abhaNumber: string | null = null;
    if (abhaIdEnc) {
      abhaNumber = safeDecrypt(abhaIdEnc);
    } else if (abhaIdPlain) {
      abhaNumber = String(abhaIdPlain);
    }
    const abha = abhaNumber ? { number: abhaNumber } : null;

    // F12: Donor directive (PIN scope only)
    const donorData = d.donorDirective as {
      bloodDonor?: boolean;
      nottoPledgeId?: string;
      advanceDirectivePath?: string;
    } | undefined;
    const nottoPledgeId = donorData?.nottoPledgeId
      ? safeDecrypt(donorData.nottoPledgeId)
      : null;
    const advanceDirectiveUrl = await signed(donorData?.advanceDirectivePath);
    const donorDirective = {
      bloodDonor: donorData?.bloodDonor ?? null,
      organDonor: (d.organDonor as string | undefined) ?? "unset",
      nottoPledgeId,
      advanceDirectiveUrl,
    };

    return NextResponse.json({
      ...base,
      idProofs: idsOut,
      address: {
        line: safeDecrypt(addr?.lineEnc),
        city: addr?.city,
        district: addr?.district,
        state: addr?.state,
        pincode: addr?.pincode,
        proofUrl: await signed(ap?.path || undefined),
        sameAsIdIndex: ap?.sameAsIdIndex ?? null,
      },
      insurance: {
        coverageType: insurance?.coverageType,
        insurerName: insurance?.private?.insurerName,
        policyNumber: safeDecrypt(insurance?.private?.policyNumberEnc),
        policyHolderName: insurance?.private?.policyHolderName,
        validTill: insurance?.private?.validTill,
        policyCardUrl: await signed(insurance?.private?.policyCardPath),
        policyBondUrl: await signed(insurance?.private?.policyBondPath),
        schemeName: insurance?.government?.schemeName,
        govtCardNumber: safeDecrypt(insurance?.government?.govtCardNumberEnc),
        govtCardUrl: await signed(insurance?.government?.govtCardPath),
      },
      abha,
      donorDirective,
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    console.error("full-details GET", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
