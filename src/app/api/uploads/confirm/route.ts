import { NextRequest, NextResponse } from "next/server";
import {
  ACTIVATION_SESSION_COOKIE,
  verifyActivationSessionToken,
} from "@/lib/activationSession";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { verifyUploadedObject } from "@/lib/storage";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { normalizeHealthId } from "@/lib/healthId";
import {
  evaluateActivationGate,
  NO_STORE_HEADERS,
} from "@/lib/activationGate";

/** POST /api/uploads/confirm — verify object exists + magic bytes */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = String(body.path || "");
    const contentType = String(body.contentType || "");
    if (!path || !contentType) {
      return NextResponse.json(
        { error: "path and contentType required" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const act = verifyActivationSessionToken(
      req.cookies.get(ACTIVATION_SESSION_COOKIE)?.value
    );
    const prof = verifyProfileSessionToken(
      req.cookies.get(PROFILE_SESSION_COOKIE)?.value
    );
    if (!act && !prof) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }
    if (act) {
      const health_id = normalizeHealthId(act.healthId);
      if (!path.startsWith(`pending/${health_id}/`)) {
        return NextResponse.json(
          { error: "Path not allowed" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
      const db = getAdminDb();
      const card = await findCardByHealthId(db, health_id);
      const gate = evaluateActivationGate(health_id, card?.isDemo === true);
      if (!gate.ok) {
        return NextResponse.json(
          { error: gate.message, code: gate.code },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
    }

    const result = await verifyUploadedObject({
      path,
      expectedType: contentType,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      { success: true, size: result.size },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error("uploads/confirm", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
