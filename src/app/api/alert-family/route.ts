import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireFeature } from "@/lib/features/server";
import { normalizeHealthId, isValidHealthId } from "@/lib/healthId";
import { findCardByHealthId } from "@/lib/cardsRepo";
import { clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/alert-family
 * Logs alert_family access (location shared yes/no only — never coordinates).
 * Returns wa.me / tel links for client to open (no third-party send API).
 */
export async function POST(req: NextRequest) {
  const flags = await requireFeature("alertFamily");
  if (!flags) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const health_id = normalizeHealthId(String(body.health_id || ""));
    if (!isValidHealthId(health_id)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const locationShared = Boolean(body.locationShared);
    const lat = typeof body.lat === "number" ? body.lat : null;
    const lng = typeof body.lng === "number" ? body.lng : null;

    const db = getAdminDb();
    const card = await findCardByHealthId(db, health_id);
    if (!card?.linkedProfileId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const snap = await db.collection("profiles").doc(card.linkedProfileId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const d = snap.data()!;
    const fullName = String(d.full_name || "").trim();
    const firstName = fullName.split(/\s+/)[0] || "Patient";
    const contacts = Array.isArray(d.emergency_contacts)
      ? (d.emergency_contacts as { name?: string; phone?: string; relation?: string }[])
      : [];

    const maps =
      locationShared && lat != null && lng != null
        ? `https://maps.google.com/?q=${lat},${lng}`
        : "Location not shared";

    const message = `EMERGENCY: ${firstName} needs help. Their KavachSaathi card was just scanned. Location: ${maps} . Please call back immediately.`;

    const links = contacts
      .map((c) => {
        const phone = String(c.phone || "").replace(/\D/g, "").slice(-10);
        if (!/^[6-9]\d{9}$/.test(phone)) return null;
        const waDigits = `91${phone}`;
        return {
          name: String(c.name || "Contact"),
          relation: c.relation || null,
          tel: `tel:+91${phone}`,
          whatsapp: `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`,
        };
      })
      .filter(Boolean);

    const ip = clientIp(req);
    await db.collection("accessLogs").add({
      health_id,
      healthId: health_id,
      mode: "alert_family",
      locationShared,
      // never store coordinates
      ipHash: createHash("sha256").update(ip).digest("hex").slice(0, 16),
      userAgent: (req.headers.get("user-agent") || "").slice(0, 200),
      at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { message, contacts: links },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("alert-family", err instanceof Error ? err.message : "fail");
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
