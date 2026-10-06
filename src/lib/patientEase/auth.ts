/** Shared auth for Pack 2 PIN / profile APIs */
import { NextRequest, NextResponse } from "next/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import {
  FULL_DETAILS_COOKIE,
  verifyFullDetailsToken,
} from "@/lib/fullDetailsSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import type { FeatureKey } from "@/lib/features/flags";
import { requireFeature } from "@/lib/features/server";
import { findCardByHealthId } from "@/lib/cardsRepo";

export async function requirePack2Feature(key: FeatureKey) {
  const feature = await requireFeature(key);
  if (!feature) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "Feature not available", code: "FEATURE_OFF" },
        { status: 404, headers: noStoreHeaders() }
      ),
    };
  }
  return { ok: true as const, flags: feature };
}

export async function requireOwnerSession(req: NextRequest): Promise<
  | {
      ok: true;
      profileId: string;
      healthId: string;
      via: "profile" | "full_details";
    }
  | { ok: false; res: NextResponse }
> {
  const db = getAdminDb();
  const profileTok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const profileSess = verifyProfileSessionToken(profileTok);
  if (profileSess) {
    const snap = await db.collection("profiles").doc(profileSess.profileId).get();
    if (snap.exists) {
      return {
        ok: true,
        profileId: profileSess.profileId,
        healthId: String(snap.data()?.health_id || ""),
        via: "profile",
      };
    }
  }
  const fdTok = req.cookies.get(FULL_DETAILS_COOKIE)?.value;
  const fd = verifyFullDetailsToken(fdTok);
  if (fd?.healthId && fd.scope === "pin") {
    const card = await findCardByHealthId(db, fd.healthId);
    const profileId = card?.linkedProfileId;
    if (profileId) {
      return {
        ok: true,
        profileId,
        healthId: fd.healthId,
        via: "full_details",
      };
    }
  }
  return {
    ok: false,
    res: NextResponse.json(
      { error: "Login or unlock Full Details with PIN" },
      { status: 401, headers: noStoreHeaders() }
    ),
  };
}
