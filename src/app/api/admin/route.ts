import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { cardIsActivated, findCardByHealthId } from "@/lib/cardsRepo";
import { normalizeCardStatus, normalizeHealthId, isValidHealthId } from "@/lib/healthId";

function adminEmails(): Set<string> {
  const raw =
    process.env.ADMIN_EMAILS ||
    "gdmtechnoworld@gmail.com,mehtadeepansh6@gmail.com";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function requireAdmin(req: NextRequest): Promise<
  { uid: string; email: string } | NextResponse
> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const email = (decoded.email || "").toLowerCase();
    if (!email || !adminEmails().has(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return { uid: decoded.uid, email };
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** GET /api/admin — list cards; ?health_id=X for card detail */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  try {
    const db = getAdminDb();
    const detailId = (req.nextUrl.searchParams.get("health_id") || "")
      .trim()
      .toUpperCase();

    if (detailId) {
      const snap = await db
        .collection("cards")
        .where("health_id", "==", detailId)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }
      const card = snap.docs[0].data();
      let profile: Record<string, unknown> | null = null;
      let missing: string[] = [];
      if (card.linkedProfileId) {
        const p = await db.collection("profiles").doc(String(card.linkedProfileId)).get();
        if (p.exists) {
          const d = p.data()!;
          profile = {
            profileId: p.id,
            full_name: d.full_name,
            phoneMasked: d.phone
              ? `+91 XXXXXX${String(d.phone).slice(-4)}`
              : null,
            profileComplete: d.profileComplete === true,
            hasPhoto: Boolean((d.photo as { path?: string } | undefined)?.path),
            idProofCount: Array.isArray(d.idProofs) ? d.idProofs.length : 0,
            hasAddress: Boolean(d.address),
            hasInsurance: Boolean(d.insurance),
          };
          const nextMissing: string[] = [];
          if (!profile.profileComplete) {
            if (!profile.hasPhoto) nextMissing.push("photo");
            if ((profile.idProofCount as number) < 2) nextMissing.push("idProofs");
            if (!profile.hasAddress) nextMissing.push("address");
            if (!profile.hasInsurance) nextMissing.push("insurance");
          }
          missing = nextMissing;
        }
      }
      const logs = await db
        .collection("accessLogs")
        .where("health_id", "==", detailId)
        .limit(50)
        .get()
        .catch(async () =>
          db.collection("accessLogs").where("healthId", "==", detailId).limit(50).get()
        );
      const accessLogs = logs.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          mode: x.mode,
          hospitalName: x.hospitalName || null,
          staffName: x.staffName || null,
          at: x.at?.toDate?.()?.toISOString?.() || null,
        };
      });
      return NextResponse.json({
        card: {
          health_id: detailId,
          status: normalizeCardStatus(card.status),
          isDemo: card.isDemo === true,
          isRehearsal: card.isRehearsal === true,
          linkedProfileId: card.linkedProfileId || null,
          activatedAt: card.activated_at?.toDate?.()?.toISOString?.() || null,
          validTill: card.validTill || null,
        },
        profile,
        missing,
        accessLogs,
      });
    }

    const snap = await db.collection("cards").get();
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toUpperCase();
    const statusFilter = (req.nextUrl.searchParams.get("status") || "")
      .trim()
      .toLowerCase();

    let cards = snap.docs.map((d) => {
      const data = d.data();
      const status = normalizeCardStatus(data.status);
      return {
        docId: d.id,
        health_id: String(data.health_id || ""),
        activation_code: String(data.activation_code || d.id),
        status,
        activatedAt: data.activated_at?.toDate?.()?.toISOString?.() || null,
        linkedProfileId: data.linkedProfileId || null,
        tier: data.tier || "STANDARD",
        validTill: data.validTill ? String(data.validTill) : null,
        isDemo: data.isDemo === true,
        isRehearsal: data.isRehearsal === true,
        serial: data.serial ? String(data.serial) : null,
        batch: typeof data.batch === "number" ? data.batch : null,
      };
    });

    cards.sort((a, b) =>
      a.activation_code.localeCompare(b.activation_code, undefined, {
        numeric: true,
      })
    );

    if (q) {
      cards = cards.filter(
        (c) =>
          c.health_id.includes(q) ||
          c.activation_code.includes(q) ||
          c.docId.includes(q) ||
          (c.serial && c.serial.includes(q))
      );
    }
    if (
      statusFilter === "activated" ||
      statusFilter === "unactivated" ||
      statusFilter === "blocked"
    ) {
      cards = cards.filter((c) => c.status === statusFilter);
    }

    const inventory = cards.filter(
      (c) =>
        !c.isDemo &&
        !c.isRehearsal &&
        !String(c.health_id || "").toUpperCase().startsWith("KVS-2099-") &&
        !String(c.health_id || "").toUpperCase().startsWith("KVS-DEMO-")
    );
    const demos = cards.filter((c) => c.isDemo);
    const rehearsalCount = cards.filter(
      (c) =>
        c.isRehearsal === true ||
        String(c.health_id || "").toUpperCase().startsWith("KVS-2099-")
    ).length;
    const batchCounts: Record<string, number> = {};
    for (const c of inventory) {
      const key = c.batch != null ? String(c.batch) : "unset";
      batchCounts[key] = (batchCounts[key] || 0) + 1;
    }

    return NextResponse.json({
      count: inventory.length,
      demoCount: demos.length,
      rehearsalCount,
      inventoryActivated: inventory.filter((c) => c.status === "activated")
        .length,
      batchCounts,
      cards,
    });
  } catch (err) {
    console.error("admin GET", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin
 * Actions: reset | export
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await req.json();
    const action = String(body.action || "");
    const db = getAdminDb();

    if (action === "reset") {
      const health_id = String(body.health_id || "").toUpperCase();
      const snap = await db
        .collection("cards")
        .where("health_id", "==", health_id)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }
      const doc = snap.docs[0];
      const data = doc.data();
      if (data.isDemo === true) {
        return NextResponse.json(
          {
            error:
              "Demo cards cannot be bulk-reset from admin. Use scripts/reset-demo-card.ts",
          },
          { status: 400 }
        );
      }
      const profileId = data.linkedProfileId as string | undefined;
      const userUid = data.user_uid as string | undefined;

      await doc.ref.update({
        status: "unactivated",
        linkedProfileId: null,
        user_uid: null,
        activated_at: null,
      });

      // Soft-clear linked profile (keep for audit trail with deactivated flag)
      if (profileId) {
        await db
          .collection("profiles")
          .doc(profileId)
          .set(
            {
              deactivated: true,
              deactivated_at: FieldValue.serverTimestamp(),
              deactivated_by: admin.email,
            },
            { merge: true }
          );
      }
      if (userUid) {
        await db
          .collection("users")
          .doc(userUid)
          .set(
            {
              card_reset: true,
              card_reset_at: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }

      return NextResponse.json({
        success: true,
        message: `Card ${health_id} reset to unactivated`,
      });
    }

    if (action === "reset-pin") {
      const health_id = String(body.health_id || "").toUpperCase();
      const new_pin = String(body.new_pin || body.pin || "");
      if (!/^\d{4,6}$/.test(new_pin)) {
        return NextResponse.json(
          { error: "PIN must be 4–6 digits" },
          { status: 400 }
        );
      }
      const snap = await db
        .collection("cards")
        .where("health_id", "==", health_id)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }
      const data = snap.docs[0].data();
      const profileId = data.linkedProfileId as string | undefined;
      if (!profileId) {
        return NextResponse.json(
          { error: "No linked profile to reset PIN" },
          { status: 404 }
        );
      }
      const { hashPin } = await import("@/lib/pin");
      const pin_hash = await hashPin(new_pin);
      await db.collection("profiles").doc(profileId).update({
        pin_hash,
        pin_reset_at: FieldValue.serverTimestamp(),
        pin_reset_by: admin.email,
      });
      return NextResponse.json({
        success: true,
        message: `PIN reset for ${health_id}`,
      });
    }

    if (action === "set-valid-till") {
      const health_id = String(body.health_id || "").toUpperCase();
      const validTill = body.validTill
        ? String(body.validTill).slice(0, 10)
        : null;
      if (validTill && !/^\d{4}-\d{2}-\d{2}$/.test(validTill)) {
        return NextResponse.json(
          { error: "validTill must be YYYY-MM-DD or empty" },
          { status: 400 }
        );
      }
      const snap = await db
        .collection("cards")
        .where("health_id", "==", health_id)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }
      await snap.docs[0].ref.update({
        validTill,
        validTill_updated_at: FieldValue.serverTimestamp(),
        validTill_updated_by: admin.email,
      });
      return NextResponse.json({
        success: true,
        message: `validTill set for ${health_id}`,
        validTill,
      });
    }

    if (action === "export") {
      const snap = await db.collection("cards").get();
      // Scrubbed CSV — never ID numbers, policy numbers, phones, or document paths
      const rows: string[] = [
        "health_id,name,city,profileComplete,activatedAt,insurerName,schemeName",
      ];

      for (const d of snap.docs) {
        const data = d.data();
        if (data.isDemo === true) continue;
        const healthId = String(data.health_id || "");
        if (healthId.startsWith("KVS-DEMO-") || healthId.startsWith("KVS-2099-")) {
          continue;
        }
        const activated = cardIsActivated({
          docId: d.id,
          activation_code: String(data.activation_code || d.id),
          health_id: healthId,
          status: String(data.status || ""),
        });
        if (!activated) continue;

        let name = "";
        let city = "";
        let profileComplete = "false";
        let insurerName = "";
        let schemeName = "";
        if (data.linkedProfileId) {
          const p = await db.collection("profiles").doc(data.linkedProfileId).get();
          const pd = p.data() || {};
          name = String(pd.full_name || "");
          city = String(pd.city || (pd.address as { city?: string } | undefined)?.city || "");
          profileComplete = pd.profileComplete === true ? "true" : "false";
          const ins = pd.insurance as
            | {
                private?: { insurerName?: string };
                government?: { schemeName?: string };
              }
            | undefined;
          insurerName = String(ins?.private?.insurerName || "");
          schemeName = String(ins?.government?.schemeName || "");
        } else if (data.user_uid) {
          const u = await db.collection("users").doc(data.user_uid).get();
          name = String(u.data()?.full_name || "");
        }
        const activatedAt =
          data.activated_at?.toDate?.()?.toISOString?.() || "";
        rows.push(
          [
            csvEscape(healthId),
            csvEscape(name),
            csvEscape(city),
            csvEscape(profileComplete),
            csvEscape(activatedAt),
            csvEscape(insurerName),
            csvEscape(schemeName),
          ].join(",")
        );
      }

      return new NextResponse(rows.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="kavachsaathi-activated.csv"',
        },
      });
    }

    if (action === "reveal") {
      const health_id = String(body.health_id || "").toUpperCase();
      const confirmed = body.confirm === true;
      if (!confirmed) {
        return NextResponse.json(
          { error: "Set confirm:true to reveal encrypted ID numbers" },
          { status: 400 }
        );
      }
      const snap = await db
        .collection("cards")
        .where("health_id", "==", health_id)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }
      const profileId = snap.docs[0].data().linkedProfileId as string | undefined;
      if (!profileId) {
        return NextResponse.json({ error: "No profile" }, { status: 404 });
      }
      const p = await db.collection("profiles").doc(profileId).get();
      if (!p.exists) {
        return NextResponse.json({ error: "No profile" }, { status: 404 });
      }
      const { decrypt, hasEncKey } = await import("@/lib/crypto");
      if (!hasEncKey()) {
        return NextResponse.json(
          { error: "PROFILE_ENC_KEY not configured" },
          { status: 503 }
        );
      }
      const d = p.data()!;
      const ids = Array.isArray(d.idProofs) ? d.idProofs : [];
      const revealed = ids.map((raw) => {
        const id = raw as {
          type?: string;
          numberEnc?: string | null;
          last4?: string;
        };
        if (id.type === "aadhaar") {
          return { type: id.type, number: `XXXX XXXX ${id.last4 || "****"}` };
        }
        let number: string | null = null;
        try {
          number = id.numberEnc ? decrypt(id.numberEnc) : null;
        } catch {
          number = null;
        }
        return { type: id.type, number };
      });

      await db.collection("accessLogs").add({
        health_id,
        healthId: health_id,
        mode: "admin",
        staffName: admin.email,
        role: "admin",
        at: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        health_id,
        idProofs: revealed,
        message: "Reveal logged to accessLogs",
      });
    }

    if (action === "block-card" || action === "unblock-card") {
      const health_id = normalizeHealthId(String(body.health_id || ""));
      if (!isValidHealthId(health_id)) {
        return NextResponse.json({ error: "Invalid health_id" }, { status: 400 });
      }
      const card = await findCardByHealthId(db, health_id);
      if (!card) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (card.isDemo !== true && /^KVS-A0(0[0-4]\d{2}|0500)$/i.test(health_id) === false) {
        // allow any non-demo; still never auto-touch real cards unless admin explicitly acts
      }
      const ref = db.collection("cards").doc(card.docId);
      if (action === "block-card") {
        await ref.set(
          {
            status: "blocked",
            blockedAt: new Date().toISOString(),
            blockedReason: "admin",
            blockedBy: admin.email,
          },
          { merge: true }
        );
        if (card.linkedProfileId) {
          await db.collection("profiles").doc(card.linkedProfileId).set(
            { cardStatus: "blocked" },
            { merge: true }
          );
        }
        await db.collection("admin_logs").add({
          action: "block_card",
          byEmail: admin.email,
          health_id,
          at: new Date().toISOString(),
        });
        return NextResponse.json({ ok: true, status: "blocked" });
      }
      await ref.set(
        {
          status: "activated",
          blockedAt: FieldValue.delete(),
          blockedReason: FieldValue.delete(),
          unblockedAt: new Date().toISOString(),
          unblockedBy: admin.email,
        },
        { merge: true }
      );
      if (card.linkedProfileId) {
        await db.collection("profiles").doc(card.linkedProfileId).set(
          { cardStatus: "activated" },
          { merge: true }
        );
      }
      await db.collection("admin_logs").add({
        action: "unblock_card",
        byEmail: admin.email,
        health_id,
        at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, status: "activated" });
    }

    if (action === "transfer-card") {
      const fromId = normalizeHealthId(String(body.from_health_id || body.health_id || ""));
      const toCode = String(body.newActivationCode || "").trim().padStart(4, "0").slice(0, 4);
      if (!isValidHealthId(fromId) || !/^\d{4}$/.test(toCode)) {
        return NextResponse.json({ error: "from_health_id and newActivationCode required" }, { status: 400 });
      }
      const oldCard = await findCardByHealthId(db, fromId);
      if (!oldCard?.linkedProfileId) {
        return NextResponse.json({ error: "Source card has no profile" }, { status: 400 });
      }
      const q = await db.collection("cards").where("activation_code", "==", toCode).limit(5).get();
      let newDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
      for (const d of q.docs) {
        const s = String(d.data().status || "unactivated");
        if (s === "unactivated" || s === "inactive") {
          newDoc = d;
          break;
        }
      }
      if (!newDoc) {
        return NextResponse.json({ error: "No unactivated card for code" }, { status: 404 });
      }
      const newHid = String(newDoc.data().health_id || newDoc.id);
      const profileId = oldCard.linkedProfileId;
      await db.runTransaction(async (tx) => {
        tx.set(
          db.collection("cards").doc(oldCard.docId),
          {
            status: "blocked",
            linkedProfileId: null,
            replacedBy: newHid,
            blockedReason: "replaced",
          },
          { merge: true }
        );
        tx.set(
          newDoc!.ref,
          {
            status: "activated",
            linkedProfileId: profileId,
            activated_at: new Date().toISOString(),
            replacedFrom: fromId,
          },
          { merge: true }
        );
        tx.set(
          db.collection("profiles").doc(profileId),
          {
            health_id: newHid,
            cardStatus: "activated",
            previousHealthId: fromId,
          },
          { merge: true }
        );
      });
      await db.collection("admin_logs").add({
        action: "transfer_card",
        byEmail: admin.email,
        health_id: fromId,
        meta: { newHealthId: newHid },
        at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, newHealthId: newHid });
    }

    if (action === "set-nfc") {
      const health_id = String(body.health_id || "").toUpperCase();
      const nfcEnabled = Boolean(body.nfcEnabled);
      const snap = await db
        .collection("cards")
        .where("health_id", "==", health_id)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }
      await snap.docs[0].ref.update({ nfcEnabled });
      return NextResponse.json({ success: true, nfcEnabled });
    }

    if (action === "get-insurers") {
      const snap = await db.collection("config").doc("insurers").get();
      const data = snap.exists ? snap.data() : null;
      return NextResponse.json({
        list: Array.isArray(data?.list) ? data!.list : [],
        updatedAt: data?.updatedAt || null,
        updatedBy: data?.updatedBy || null,
      });
    }

    if (action === "save-insurers") {
      const raw = body.list;
      if (!Array.isArray(raw)) {
        return NextResponse.json(
          { error: "list must be an array" },
          { status: 400 }
        );
      }
      const list = [];
      for (const row of raw) {
        if (!row || typeof row !== "object") continue;
        const name = String((row as { name?: string }).name || "").trim();
        const tpaHelpline = String(
          (row as { tpaHelpline?: string }).tpaHelpline || ""
        ).trim();
        const claimsHelpline = String(
          (row as { claimsHelpline?: string }).claimsHelpline ||
            tpaHelpline ||
            ""
        ).trim();
        const sourceUrl = String(
          (row as { sourceUrl?: string }).sourceUrl || ""
        ).trim();
        if (!name || !tpaHelpline) {
          return NextResponse.json(
            { error: "Each insurer needs name + tpaHelpline" },
            { status: 400 }
          );
        }
        if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
          return NextResponse.json(
            { error: `sourceUrl must be http(s) for ${name}` },
            { status: 400 }
          );
        }
        list.push({
          name,
          tpaHelpline,
          claimsHelpline: claimsHelpline || tpaHelpline,
          email: String((row as { email?: string }).email || "").trim() || null,
          website:
            String((row as { website?: string }).website || "").trim() || null,
          sourceUrl: sourceUrl || null,
        });
      }
      await db.collection("config").doc("insurers").set(
        {
          list,
          updatedAt: new Date().toISOString(),
          updatedBy: admin.email,
        },
        { merge: true }
      );
      return NextResponse.json({
        success: true,
        count: list.length,
        message: `Saved ${list.length} insurers`,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("admin POST", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
