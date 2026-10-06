import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { renewalWaLink } from "@/lib/config/links";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { trackAgg } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/profile/renewal-request
 * Marks renewalRequestedAt and returns a wa.me URL (no paid APIs).
 */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("cardValidity");
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

    const db = getAdminDb();
    const snap = await db.collection("profiles").doc(sess.profileId).get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    const d = snap.data()!;
    const health_id = String(d.health_id || "");
    const name = String(d.full_name || "").trim() || "Cardholder";
    const card = health_id ? await findCardByHealthId(db, health_id) : null;
    const serial =
      (card && (card as { serial?: string }).serial) ||
      health_id ||
      sess.profileId;

    const now = new Date().toISOString();
    await snap.ref.update({
      renewalRequestedAt: now,
      updated_at: FieldValue.serverTimestamp(),
    });
    if (card) {
      await db.collection("cards").doc(card.docId).update({
        renewalRequestedAt: now,
      });
    }

    trackAgg({ type: "renewal_request", city: String(d.city || "") || null });

    const waUrl = renewalWaLink(String(serial), name);
    return NextResponse.json(
      { success: true, waUrl, renewalRequestedAt: now },
      { headers: noStoreHeaders() }
    );
  } catch (err) {
    console.error("renewal-request", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
