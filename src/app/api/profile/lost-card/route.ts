import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  cardIsBlocked,
  findCardByHealthId,
} from "@/lib/cardsRepo";
import { verifyPin } from "@/lib/pin";
import { normalizeHealthId, isValidHealthId } from "@/lib/healthId";
import {
  checkRateLimit,
  clientIp,
  makeMathCaptcha,
  verifyMathCaptcha,
} from "@/lib/rateLimit";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import { trackAgg } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UNBLOCK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

async function findUnactivatedByCode(
  db: Firestore,
  codeRaw: string
): Promise<{ docId: string; health_id: string; data: FirebaseFirestore.DocumentData } | null> {
  const code = String(codeRaw || "").trim().padStart(4, "0").slice(0, 4);
  if (!/^\d{4}$/.test(code)) return null;

  const q = await db
    .collection("cards")
    .where("activation_code", "==", code)
    .limit(5)
    .get();

  for (const d of q.docs) {
    const data = d.data();
    if (data.isDemo === true) continue;
    const st = String(data.status || "unactivated");
    if (st === "activated" || st === "active" || st === "blocked") continue;
    const health_id = String(data.health_id || "");
    if (!isValidHealthId(health_id)) continue;
    return { docId: d.id, health_id, data };
  }

  const direct = await db.collection("cards").doc(code).get();
  if (direct.exists) {
    const data = direct.data()!;
    const st = String(data.status || "unactivated");
    if (st !== "activated" && st !== "active" && st !== "blocked") {
      const health_id = String(data.health_id || "");
      if (isValidHealthId(health_id)) {
        return { docId: direct.id, health_id, data };
      }
    }
  }
  return null;
}

function blockedAtMs(data: FirebaseFirestore.DocumentData): number | null {
  const raw = data.blocked_at || data.blockedAt;
  if (!raw) return null;
  if (typeof raw?.toDate === "function") return raw.toDate().getTime();
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * POST /api/profile/lost-card
 * actions: report | unblock | replace
 */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("lostCard");
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
        { error: "Not logged in" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const body = await req.json();
    const action = String(body.action || "").toLowerCase();
    const pin = String(body.pin || "");
    if (!["report", "unblock", "replace"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: "Re-enter your PIN (4–6 digits)" },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const db = getAdminDb();
    const ip = clientIp(req);
    const rl = await checkRateLimit({
      key: `lost-card:${ip}`,
      limit: 10,
      windowMs: 5 * 60_000,
      captchaAfter: 5,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Wait a few minutes.",
          captchaRequired: true,
          captcha: makeMathCaptcha(),
        },
        { status: 429, headers: noStoreHeaders() }
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
            captchaRequired: true,
            captcha: makeMathCaptcha(),
          },
          { status: 403, headers: noStoreHeaders() }
        );
      }
    }

    const profileSnap = await db.collection("profiles").doc(sess.profileId).get();
    if (!profileSnap.exists) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    const profile = profileSnap.data()!;
    const ok = await verifyPin(pin, String(profile.pin_hash || ""));
    if (!ok) {
      return NextResponse.json(
        { error: "Incorrect PIN" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const health_id = String(profile.health_id || "");
    const card = await findCardByHealthId(db, health_id);
    if (!card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    const cardRef = db.collection("cards").doc(card.docId);

    if (action === "report") {
      const confirm = body.confirm === true;
      if (!confirm) {
        return NextResponse.json(
          { error: "Set confirm:true to report card lost" },
          { status: 400, headers: noStoreHeaders() }
        );
      }
      if (cardIsBlocked(card)) {
        return NextResponse.json(
          { success: true, status: "blocked" },
          { headers: noStoreHeaders() }
        );
      }
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(cardRef);
        if (!fresh.exists) {
          throw Object.assign(new Error("Card not found"), { status: 404 });
        }
        const st = String(fresh.data()?.status || "");
        if (st === "blocked") return;
        if (st !== "activated" && st !== "active") {
          throw Object.assign(new Error("Only activated cards can be reported lost"), {
            status: 409,
          });
        }
        tx.update(cardRef, {
          status: "blocked",
          blocked_at: FieldValue.serverTimestamp(),
          lostReportedAt: FieldValue.serverTimestamp(),
          lostReportedBy: "owner",
        });
      });
      trackAgg({ type: "lost_report" });
      await db.collection("admin_logs").add({
        action: "lost_report",
        health_id,
        by: "owner",
        profileId: sess.profileId,
        at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json(
        { success: true, status: "blocked" },
        { headers: noStoreHeaders() }
      );
    }

    if (action === "unblock") {
      if (!cardIsBlocked(card)) {
        return NextResponse.json(
          { success: true, status: "activated" },
          { headers: noStoreHeaders() }
        );
      }
      const freshData = (await cardRef.get()).data() || {};
      const at = blockedAtMs(freshData);
      if (at == null || Date.now() - at > UNBLOCK_WINDOW_MS) {
        return NextResponse.json(
          {
            error:
              "Unblock window (7 days) has passed. Request a replacement card instead.",
            code: "UNBLOCK_WINDOW_CLOSED",
          },
          { status: 403, headers: noStoreHeaders() }
        );
      }
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(cardRef);
        if (!fresh.exists) {
          throw Object.assign(new Error("Card not found"), { status: 404 });
        }
        if (String(fresh.data()?.status || "") !== "blocked") return;
        tx.update(cardRef, {
          status: "activated",
          unblocked_at: FieldValue.serverTimestamp(),
        });
      });
      await db.collection("admin_logs").add({
        action: "lost_unblock",
        health_id,
        by: "owner",
        profileId: sess.profileId,
        at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json(
        { success: true, status: "activated" },
        { headers: noStoreHeaders() }
      );
    }

    // replace — new activation code → atomic transfer
    const newCode = String(body.activation_code || body.new_activation_code || "");
    const newCard = await findUnactivatedByCode(db, newCode);
    if (!newCard || !isValidHealthId(newCard.health_id)) {
      return NextResponse.json(
        { error: "Invalid or already-used activation code" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    // Hard rule: never transfer onto another activated/blocked card
    const newRef = db.collection("cards").doc(newCard.docId);
    const oldHid = health_id;
    const newHid = normalizeHealthId(newCard.health_id);

    if (newHid === oldHid) {
      return NextResponse.json(
        { error: "Enter the activation code from your replacement card" },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    await db.runTransaction(async (tx) => {
      const [oldSnap, newSnap, profSnap] = await Promise.all([
        tx.get(cardRef),
        tx.get(newRef),
        tx.get(profileSnap.ref),
      ]);
      if (!oldSnap.exists || !newSnap.exists || !profSnap.exists) {
        throw Object.assign(new Error("Card or profile missing"), { status: 404 });
      }
      const nd = newSnap.data()!;
      const nst = String(nd.status || "unactivated");
      if (nst === "activated" || nst === "active" || nst === "blocked") {
        throw Object.assign(new Error("Replacement card is not available"), {
          status: 409,
        });
      }
      if (nd.linkedProfileId) {
        throw Object.assign(new Error("Replacement card already linked"), {
          status: 409,
        });
      }
      const entered = String(newCode).trim().padStart(4, "0").slice(0, 4);
      const stored = String(nd.activation_code || newSnap.id)
        .padStart(4, "0")
        .slice(0, 4);
      if (stored !== entered) {
        throw Object.assign(new Error("Activation code mismatch"), { status: 403 });
      }

      // Old stays blocked, unlinked
      tx.update(cardRef, {
        status: "blocked",
        linkedProfileId: null,
        replacedByHealthId: newHid,
        replacedAt: FieldValue.serverTimestamp(),
      });

      // New card activated + linked to same profile (PIN/docs/logs stay on profile)
      const nowIso = new Date().toISOString();
      tx.update(newRef, {
        status: "activated",
        linkedProfileId: sess.profileId,
        activated_at: FieldValue.serverTimestamp(),
        validFrom: nowIso,
        validTill: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
        replacedFromHealthId: oldHid,
      });

      tx.update(profileSnap.ref, {
        health_id: newHid,
        previous_health_id: oldHid,
        card_replaced_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    });

    await db.collection("admin_logs").add({
      action: "lost_replace",
      health_id: oldHid,
      new_health_id: newHid,
      by: "owner",
      profileId: sess.profileId,
      at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        status: "replaced",
        old_health_id: oldHid,
        health_id: newHid,
      },
      { headers: noStoreHeaders() }
    );
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message = err instanceof Error ? err.message : "Lost card action failed";
    console.error("profile/lost-card", err);
    return NextResponse.json(
      { error: message },
      {
        status: status === 403 || status === 409 || status === 404 ? status : 500,
        headers: noStoreHeaders(),
      }
    );
  }
}
