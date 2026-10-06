import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebase-admin";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { normalizeHealthId, isValidHealthId } from "@/lib/healthId";
import {
  addDaysIso,
  computeValidity,
  VALIDITY_DAYS,
} from "@/lib/validity";
import { renewalWaLink } from "@/lib/config/links";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function maskPhone(phone: unknown): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  return `+91 XXXXXX${digits.slice(-4)}`;
}

/**
 * GET /api/admin/validity?expiring=30
 * List cards expiring within N days (default 30).
 *
 * POST /api/admin/validity
 * { action: "extend", health_id } — extend validTill by 1 year from current till (or now).
 */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("cardValidity");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  try {
    const days = Math.min(
      90,
      Math.max(1, Number(req.nextUrl.searchParams.get("expiring") || 30) || 30)
    );
    const db = getAdminDb();
    const snap = await db.collection("cards").get();
    const now = Date.now();
    const horizon = now + days * 86400000;
    const rows: {
      health_id: string;
      validTill: string | null;
      daysRemaining: number | null;
      phoneMasked: string | null;
      name: string | null;
      waUrl: string | null;
      status: string;
      isDemo: boolean;
    }[] = [];

    for (const d of snap.docs) {
      const data = d.data();
      if (data.isDemo === true) continue;
      const health_id = String(data.health_id || "");
      if (!health_id || health_id.startsWith("KVS-DEMO-") || health_id.startsWith("KVS-2099-")) {
        continue;
      }
      const status = String(data.status || "");
      if (status !== "activated" && status !== "active") continue;

      const v = computeValidity(data.activated_at, data.validTill);
      if (!v.validTill || v.daysRemaining == null) continue;
      const tillMs = new Date(v.validTill).getTime();
      // Include already-expired-in-grace and upcoming within window
      if (tillMs > horizon) continue;
      if (v.isPastGrace) continue;

      let phoneMasked: string | null = null;
      let name: string | null = null;
      if (data.linkedProfileId) {
        const p = await db.collection("profiles").doc(String(data.linkedProfileId)).get();
        if (p.exists) {
          const pd = p.data()!;
          phoneMasked = maskPhone(pd.phone);
          name = String(pd.full_name || "").trim() || null;
        }
      }

      rows.push({
        health_id,
        validTill: v.validTill ? v.validTill.toISOString() : null,
        daysRemaining: v.daysRemaining,
        phoneMasked,
        name,
        waUrl: name ? renewalWaLink(health_id, name) : null,
        status,
        isDemo: false,
      });
    }

    rows.sort(
      (a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999)
    );

    return NextResponse.json(
      { count: rows.length, days, cards: rows },
      { headers: noStoreHeaders() }
    );
  } catch (err) {
    console.error("admin/validity GET", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

export async function POST(req: NextRequest) {
  const feature = await requireFeature("cardValidity");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await req.json();
    const action = String(body.action || "");
    const health_id = normalizeHealthId(String(body.health_id || ""));
    if (!isValidHealthId(health_id)) {
      return NextResponse.json(
        { error: "Invalid health_id" },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const db = getAdminDb();
    const card = await findCardByHealthId(db, health_id);
    if (!card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404, headers: noStoreHeaders() }
      );
    }

    if (action === "extend") {
      const currentTill = card.validTill
        ? new Date(card.validTill)
        : new Date();
      const base =
        !Number.isNaN(currentTill.getTime()) && currentTill.getTime() > Date.now()
          ? currentTill
          : new Date();
      const newTill = addDaysIso(base, VALIDITY_DAYS);
      const patch = {
        validTill: newTill,
        validTill_updated_at: FieldValue.serverTimestamp(),
        validTill_updated_by: admin.email,
        renewalRequestedAt: null,
      };
      await db.collection("cards").doc(card.docId).update(patch);
      if (card.linkedProfileId) {
        await db.collection("profiles").doc(card.linkedProfileId).update({
          validTill: newTill,
          renewalRequestedAt: null,
          updated_at: FieldValue.serverTimestamp(),
        });
      }
      await db.collection("admin_logs").add({
        action: "validity_extend",
        health_id,
        by: admin.email,
        validTill: newTill,
        at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json(
        { success: true, health_id, validTill: newTill },
        { headers: noStoreHeaders() }
      );
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400, headers: noStoreHeaders() }
    );
  } catch (err) {
    console.error("admin/validity POST", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
