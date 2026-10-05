import { NextRequest, NextResponse } from "next/server";
import {
  ACTIVATION_SESSION_COOKIE,
  verifyActivationSessionToken,
} from "@/lib/activationSession";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import {
  ALLOWED_UPLOAD_TYPES,
  getSignedPutUrl,
  isStorageConfigured,
  maxBytesForType,
} from "@/lib/storage";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { normalizeHealthId } from "@/lib/healthId";
import {
  evaluateActivationGate,
  NO_STORE_HEADERS,
} from "@/lib/activationGate";

const KINDS = [
  "photo",
  "id1-front",
  "id1-back",
  "id2-front",
  "id2-back",
  "address-proof",
  "policy-card",
  "policy-bond",
  "govt-card",
] as const;

/**
 * POST /api/uploads/signed-put
 * Issues a V4 signed PUT URL for activation session or profile session.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: "Storage not configured", code: "STORAGE_NOT_READY" },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json();
    const kind = String(body.kind || "") as (typeof KINDS)[number];
    const contentType = String(body.contentType || "");
    if (!KINDS.includes(kind)) {
      return NextResponse.json(
        { error: "Invalid kind" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    if (
      !ALLOWED_UPLOAD_TYPES.includes(
        contentType as (typeof ALLOWED_UPLOAD_TYPES)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Invalid content type" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    if (kind === "photo" && contentType === "application/pdf") {
      return NextResponse.json(
        { error: "Photo must be an image" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const act = verifyActivationSessionToken(
      req.cookies.get(ACTIVATION_SESSION_COOKIE)?.value
    );
    const prof = verifyProfileSessionToken(
      req.cookies.get(PROFILE_SESSION_COOKIE)?.value
    );

    let health_id: string | null = null;
    let prefix: string;

    if (act) {
      health_id = normalizeHealthId(act.healthId);
      const db = getAdminDb();
      const card = await findCardByHealthId(db, health_id);
      const gate = evaluateActivationGate(health_id, card?.isDemo === true);
      if (!gate.ok) {
        return NextResponse.json(
          { error: gate.message, code: gate.code },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
      prefix = `pending/${health_id}/${act.sessionId}`;
    } else if (prof) {
      const db = getAdminDb();
      const snap = await db.collection("profiles").doc(prof.profileId).get();
      if (!snap.exists) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }
      health_id = normalizeHealthId(String(snap.data()?.health_id || ""));
      prefix = `profiles/${health_id}`;
    } else {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const ext =
      contentType === "application/pdf"
        ? "pdf"
        : contentType === "image/png"
          ? "png"
          : "jpg";
    const path = `${prefix}/${kind}.${ext}`;
    const url = await getSignedPutUrl({ path, contentType });

    return NextResponse.json(
      {
        url,
        path,
        maxBytes: maxBytesForType(contentType),
        contentType,
        expiresInSec: 600,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error("signed-put", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
