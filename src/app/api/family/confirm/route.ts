import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { verifyPin } from "@/lib/pin";
import { normalizePin } from "@/lib/pin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/family/confirm — confirm family group invitation with PIN */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("familyPlan");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
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
  const profSnap = await db.collection("profiles").doc(sess.profileId).get();
  if (!profSnap.exists) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }
  const profData = profSnap.data()!;

  const body = await req.json();
  const pin = normalizePin(String(body.pin || ""));

  // Verify PIN
  const ok = await verifyPin(pin, String(profData.pin_hash || ""));
  if (!ok) {
    return NextResponse.json(
      { error: "Incorrect PIN" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const groupId = profData.pendingFamilyGroupId as string | undefined;
  if (!groupId) {
    return NextResponse.json(
      { error: "No pending invitation found" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const healthId = String(profData.health_id || "");

  const groupRef = db.collection("familyGroups").doc(groupId);
  const groupSnap = await groupRef.get();
  if (!groupSnap.exists) {
    return NextResponse.json(
      { error: "Family group not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const members = (groupSnap.data()?.members as unknown[]) ?? [];
  const updated = members.map((m: unknown) => {
    const mem = m as Record<string, unknown>;
    if (mem.healthId === healthId && mem.status === "pending") {
      return {
        ...mem,
        status: "confirmed",
        confirmedAt: FieldValue.serverTimestamp(),
      };
    }
    return mem;
  });

  await groupRef.update({ members: updated });

  // Clear pending invitation + store groupId
  await db
    .collection("profiles")
    .doc(sess.profileId)
    .update({
      familyGroupId: groupId,
      pendingFamilyGroupId: FieldValue.delete(),
      pendingFamilyGroupInvitedBy: FieldValue.delete(),
    });

  return NextResponse.json(
    { success: true, groupId },
    { headers: noStoreHeaders() }
  );
}
