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

const MAX_FAMILY_SIZE = 6;

async function getProfileIdAndHealthId(
  req: NextRequest
): Promise<{ profileId: string; healthId: string } | null> {
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  return {
    profileId: sess.profileId,
    healthId: String(snap.data()?.health_id || ""),
  };
}

/** GET /api/family — list family group members */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("familyPlan");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const auth = await getProfileIdAndHealthId(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const profSnap = await db.collection("profiles").doc(auth.profileId).get();
  const groupId = profSnap.data()?.familyGroupId as string | undefined;

  if (!groupId) {
    return NextResponse.json(
      { group: null, members: [] },
      { headers: noStoreHeaders() }
    );
  }

  const groupSnap = await db.collection("familyGroups").doc(groupId).get();
  if (!groupSnap.exists) {
    return NextResponse.json(
      { group: null, members: [] },
      { headers: noStoreHeaders() }
    );
  }

  const data = groupSnap.data()!;
  const members = (data.members as unknown[]) ?? [];

  // Sanitize: only return safe fields
  const safe = members.map((m: unknown) => {
    const mem = m as Record<string, unknown>;
    return {
      healthId: mem.healthId,
      displayName: mem.displayName,
      status: mem.status,
      addedAt: (mem.addedAt as { toDate?: () => Date })?.toDate?.()?.toISOString(),
      confirmedAt: (mem.confirmedAt as { toDate?: () => Date })?.toDate?.()?.toISOString(),
    };
  });

  return NextResponse.json(
    { groupId, members: safe },
    { headers: noStoreHeaders() }
  );
}

/** POST /api/family — initiate linking another card */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("familyPlan");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const auth = await getProfileIdAndHealthId(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const body = await req.json();
  const targetHealthId = String(body.targetHealthId || "").trim().toUpperCase();
  if (!targetHealthId || targetHealthId === auth.healthId) {
    return NextResponse.json(
      { error: "Invalid target health ID" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();

  // Find target profile
  const targetQ = await db
    .collection("profiles")
    .where("health_id", "==", targetHealthId)
    .limit(1)
    .get();
  if (targetQ.empty) {
    return NextResponse.json(
      { error: "Target card not found or not activated" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const targetProfileId = targetQ.docs[0].id;
  const targetData = targetQ.docs[0].data();

  // Get or create family group
  let groupId = (
    await db.collection("profiles").doc(auth.profileId).get()
  ).data()?.familyGroupId as string | undefined;

  if (!groupId) {
    const groupRef = await db.collection("familyGroups").add({
      createdBy: auth.healthId,
      createdAt: FieldValue.serverTimestamp(),
      members: [
        {
          healthId: auth.healthId,
          profileId: auth.profileId,
          displayName: "",
          status: "confirmed",
          addedAt: FieldValue.serverTimestamp(),
          confirmedAt: FieldValue.serverTimestamp(),
        },
      ],
    });
    groupId = groupRef.id;
    await db
      .collection("profiles")
      .doc(auth.profileId)
      .update({ familyGroupId: groupId });
  }

  // Check size limit
  const groupSnap = await db.collection("familyGroups").doc(groupId).get();
  const members = (groupSnap.data()?.members as unknown[]) ?? [];
  if (members.length >= MAX_FAMILY_SIZE) {
    return NextResponse.json(
      { error: `Family group limited to ${MAX_FAMILY_SIZE} members` },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  // Check if target already in group
  const alreadyIn = members.some(
    (m: unknown) => (m as Record<string, unknown>).healthId === targetHealthId
  );
  if (alreadyIn) {
    return NextResponse.json(
      { error: "Already in family group" },
      { status: 409, headers: noStoreHeaders() }
    );
  }

  // Add pending member
  await db
    .collection("familyGroups")
    .doc(groupId)
    .update({
      members: [
        ...members,
        {
          healthId: targetHealthId,
          profileId: targetProfileId,
          displayName: String(targetData.full_name || ""),
          status: "pending",
          addedAt: FieldValue.serverTimestamp(),
          confirmedAt: null,
          invitedBy: auth.healthId,
        },
      ],
    });

  // Notify target profile of pending invitation
  await db
    .collection("profiles")
    .doc(targetProfileId)
    .update({ pendingFamilyGroupId: groupId, pendingFamilyGroupInvitedBy: auth.healthId });

  return NextResponse.json(
    { groupId, success: true, message: "Invitation sent — ask the member to confirm with their PIN" },
    { headers: noStoreHeaders() }
  );
}

/** DELETE /api/family — remove self from family group */
export async function DELETE(req: NextRequest) {
  const feature = await requireFeature("familyPlan");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const auth = await getProfileIdAndHealthId(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const body = await req.json().catch(() => ({}));
  const removeHealthId = String(body.healthId || auth.healthId);
  const pin = normalizePin(String(body.pin || ""));

  const db = getAdminDb();
  const profSnap = await db.collection("profiles").doc(auth.profileId).get();
  const profData = profSnap.data()!;

  // Verify PIN
  const ok = await verifyPin(pin, String(profData.pin_hash || ""));
  if (!ok) {
    return NextResponse.json(
      { error: "Incorrect PIN" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const groupId = profData.familyGroupId as string | undefined;
  if (!groupId) {
    return NextResponse.json(
      { error: "Not in a family group" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const groupRef = db.collection("familyGroups").doc(groupId);
  const groupSnap = await groupRef.get();
  if (!groupSnap.exists) {
    return NextResponse.json(
      { error: "Family group not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const members = (groupSnap.data()?.members as unknown[]) ?? [];
  const updated = members.filter(
    (m: unknown) => (m as Record<string, unknown>).healthId !== removeHealthId
  );
  await groupRef.update({ members: updated });

  // If removing self, clear familyGroupId from profile
  if (removeHealthId === auth.healthId) {
    await db
      .collection("profiles")
      .doc(auth.profileId)
      .update({ familyGroupId: FieldValue.delete() });
  }

  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}
