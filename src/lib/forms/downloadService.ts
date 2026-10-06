import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { decrypt, hasEncKey } from "@/lib/crypto";
import {
  FULL_DETAILS_COOKIE,
  verifyFullDetailsToken,
  type FullDetailsScope,
} from "@/lib/fullDetailsSession";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { getObjectBytes, isStorageConfigured } from "@/lib/storage";
import {
  extractAdmissionFields,
  extractCashlessFields,
} from "./formData";
import { buildCashlessFormPdf, cashlessFilename } from "./cashlessPdf";
import {
  admissionFilename,
  buildAdmissionSheetPdf,
} from "./admissionPdf";
import { noStoreHeaders } from "./pdfCommon";
import { computeValidity, pastGraceResponseBody } from "@/lib/validity";
import { loadFeatureFlags } from "@/lib/features/server";

export type FormAccessMode = "pin_form" | "pin_sheet" | "emergency_sheet";

async function rejectIfOwnerPastGrace(card: { validFrom?: unknown; validTill?: unknown; activated_at?: unknown } | null | undefined) {
  const flags = await loadFeatureFlags().catch(() => null);
  if (!flags?.cardValidity || !card) return null;
  const v = computeValidity({
    validFrom: card.validFrom || card.activated_at,
    validTill: card.validTill,
    activatedAt: card.activated_at,
  });
  if (v.ownerFeaturesLocked) {
    return Response.json(pastGraceResponseBody(), {
      status: 403,
      headers: noStoreHeaders(),
    });
  }
  return null;
}

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

async function writeFormAccessLog(opts: {
  health_id: string;
  mode: FormAccessMode;
  hospitalName?: string | null;
  staffName?: string | null;
  role?: string | null;
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
    ipHash: createHash("sha256").update(opts.ip).digest("hex").slice(0, 16),
    userAgent: opts.ua.slice(0, 200),
    at: FieldValue.serverTimestamp(),
  });
}

export async function requireFormSession(req: NextRequest): Promise<
  | { ok: true; healthId: string; scope: FullDetailsScope }
  | { ok: false; status: number; error: string; code?: string }
> {
  const token = req.cookies.get(FULL_DETAILS_COOKIE)?.value;
  const session = verifyFullDetailsToken(token);
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "PIN or hospital session required",
      code: "SESSION_EXPIRED",
    };
  }
  return { ok: true, healthId: session.healthId, scope: session.scope };
}

async function rateLimitDownloads(healthId: string) {
  const db = getAdminDb();
  return checkRateLimit({
    key: `form-download:${healthId}`,
    limit: 10,
    windowMs: 60 * 60_000,
    captchaAfter: 99,
    db,
  });
}

async function loadPhotoBytes(
  data: Record<string, unknown>
): Promise<Uint8Array | null> {
  if (!isStorageConfigured()) return null;
  const photoPath = (data.photo as { path?: string } | undefined)?.path;
  if (!photoPath) return null;
  try {
    const buf = await getObjectBytes(photoPath);
    return buf ? new Uint8Array(buf) : null;
  } catch {
    return null;
  }
}

export async function handleCashlessDownload(req: NextRequest) {
  const session = await requireFormSession(req);
  if (!session.ok) {
    return Response.json(
      { error: session.error, code: session.code },
      { status: session.status, headers: noStoreHeaders() }
    );
  }
  if (session.scope !== "pin") {
    return Response.json(
      {
        error: "Cashless form requires patient/family PIN access",
        code: "FORBIDDEN_SCOPE",
      },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const ip = clientIp(req);
  const rl = await rateLimitDownloads(session.healthId);
  if (!rl.allowed) {
    return Response.json(
      { error: "Download rate limit exceeded (10/hour)", code: "RATE_LIMITED" },
      { status: 429, headers: noStoreHeaders() }
    );
  }

  const found = await loadProfile(session.healthId);
  if (!found) {
    return Response.json(
      { error: "Not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const fields = extractCashlessFields(found.data);
  const { bytes } = await buildCashlessFormPdf(fields);

  await writeFormAccessLog({
    health_id: session.healthId,
    mode: "pin_form",
    ip,
    ua: req.headers.get("user-agent") || "",
  });

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${cashlessFilename()}"`,
    },
  });
}

export async function handleAdmissionDownload(req: NextRequest) {
  const session = await requireFormSession(req);
  if (!session.ok) {
    return Response.json(
      { error: session.error, code: session.code },
      { status: session.status, headers: noStoreHeaders() }
    );
  }

  const ip = clientIp(req);
  const rl = await rateLimitDownloads(session.healthId);
  if (!rl.allowed) {
    return Response.json(
      { error: "Download rate limit exceeded (10/hour)", code: "RATE_LIMITED" },
      { status: 429, headers: noStoreHeaders() }
    );
  }

  const found = await loadProfile(session.healthId);
  if (!found) {
    return Response.json(
      { error: "Not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const limited = session.scope === "emergency";
  const photoBytes = await loadPhotoBytes(found.data);
  const fields = extractAdmissionFields(found.data, { limited, photoBytes });
  const { bytes } = await buildAdmissionSheetPdf(fields, { limited });

  // Pull last emergency hospital fields if present on recent log (best-effort)
  let hospitalName: string | null = null;
  let staffName: string | null = null;
  let role: string | null = null;
  if (limited) {
    try {
      const db = getAdminDb();
      const recent = await db
        .collection("accessLogs")
        .where("health_id", "==", session.healthId)
        .where("mode", "==", "emergency")
        .limit(5)
        .get();
      const row = recent.docs[0]?.data();
      hospitalName = (row?.hospitalName as string) || null;
      staffName = (row?.staffName as string) || null;
      role = (row?.role as string) || null;
    } catch {
      /* ignore */
    }
  }

  await writeFormAccessLog({
    health_id: session.healthId,
    mode: limited ? "emergency_sheet" : "pin_sheet",
    hospitalName,
    staffName,
    role,
    ip,
    ua: req.headers.get("user-agent") || "",
  });

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${admissionFilename(limited)}"`,
    },
  });
}

/** Merge optional cashless fields into insurance / profile patches (encrypt IDs). */
export function mergeOptionalCashlessIntoInsurance(
  existing: Record<string, unknown> | null | undefined,
  incoming: {
    tpaName?: string | null;
    memberId?: string | null;
    isGroupPolicy?: boolean;
    corporateName?: string | null;
    employeeId?: string | null;
    otherMediclaim?: {
      hasOther?: boolean;
      companyName?: string | null;
      policyNumber?: string | null;
    } | null;
  },
  encryptFn: (s: string) => string
): Record<string, unknown> {
  const base = { ...(existing || {}) } as Record<string, unknown>;
  const priv = {
    ...((base.private as Record<string, unknown>) || {}),
  };
  if (incoming.tpaName !== undefined) {
    priv.tpaName = String(incoming.tpaName || "").trim() || null;
  }
  if (incoming.memberId !== undefined) {
    const m = String(incoming.memberId || "").trim();
    priv.memberIdEnc = m ? encryptFn(m) : null;
  }
  if (incoming.isGroupPolicy !== undefined) {
    priv.isGroupPolicy = Boolean(incoming.isGroupPolicy);
  }
  if (incoming.corporateName !== undefined) {
    priv.corporateName = String(incoming.corporateName || "").trim() || null;
  }
  if (incoming.employeeId !== undefined) {
    const e = String(incoming.employeeId || "").trim();
    priv.employeeIdEnc = e ? encryptFn(e) : null;
  }
  if (Object.keys(priv).length) base.private = priv;

  if (incoming.otherMediclaim !== undefined && incoming.otherMediclaim !== null) {
    const om = incoming.otherMediclaim;
    const pol = String(om.policyNumber || "").trim();
    base.otherMediclaim = {
      hasOther: Boolean(om.hasOther),
      companyName: String(om.companyName || "").trim() || null,
      policyNumberEnc: pol ? encryptFn(pol) : null,
    };
  }
  return base;
}

export function safeDecryptExport(enc: unknown): string {
  if (!enc || typeof enc !== "string" || !hasEncKey()) return "";
  try {
    return decrypt(enc);
  } catch {
    return "";
  }
}
