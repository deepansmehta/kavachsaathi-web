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

/** POST /api/uploads/confirm — verify object exists + magic bytes */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = String(body.path || "");
    const contentType = String(body.contentType || "");
    if (!path || !contentType) {
      return NextResponse.json({ error: "path and contentType required" }, { status: 400 });
    }

    const act = verifyActivationSessionToken(
      req.cookies.get(ACTIVATION_SESSION_COOKIE)?.value
    );
    const prof = verifyProfileSessionToken(
      req.cookies.get(PROFILE_SESSION_COOKIE)?.value
    );
    if (!act && !prof) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (act && !path.startsWith(`pending/${act.healthId}/`)) {
      return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
    }

    const result = await verifyUploadedObject({
      path,
      expectedType: contentType,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, size: result.size });
  } catch (err) {
    console.error("uploads/confirm", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
