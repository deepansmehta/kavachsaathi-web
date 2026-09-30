import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { scanRetentionCutoff } from "@/lib/scans";

function formatIST(ts: Timestamp | null): string {
  if (!ts) return "—";
  try {
    const d = ts.toDate();
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "—";
  }
}

/** GET /api/profile/scans — latest 20 scans (<180 days) for logged-in owner */
export async function GET() {
  try {
    const token = cookies().get(PROFILE_SESSION_COOKIE)?.value;
    const session = verifyProfileSessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const db = getAdminDb();
    const profileSnap = await db
      .collection("profiles")
      .doc(session.profileId)
      .get();
    if (!profileSnap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const profile = profileSnap.data()!;
    const healthId = String(profile.health_id || "");
    const lastSeen = profile.lastSeenScansAt?.toDate?.()
      ? (profile.lastSeenScansAt as Timestamp).toDate()
      : null;

    const cutoff = scanRetentionCutoff();
    const snap = await db
      .collection("scans")
      .where("healthId", "==", healthId)
      .orderBy("scannedAt", "desc")
      .limit(40)
      .get();

    const scans = snap.docs
      .map((d) => {
        const data = d.data();
        const scannedAt = data.scannedAt as Timestamp | undefined;
        const at = scannedAt?.toDate?.() || null;
        if (at && at < cutoff) return null;
        return {
          id: d.id,
          scannedAt: at ? at.toISOString() : null,
          scannedAtIST: formatIST(scannedAt || null),
          cityApprox: data.cityApprox ? String(data.cityApprox) : null,
          locationShared: Boolean(data.locationShared),
          emergencyMode: Boolean(data.emergencyMode),
          userAgentType: String(data.userAgentType || "unknown"),
          sectionsRendered: Array.isArray(data.sectionsRendered)
            ? data.sectionsRendered
            : [],
          scanCountInWindow: Number(data.scanCountInWindow || 1),
        };
      })
      .filter(Boolean)
      .slice(0, 20);

    const newSinceLastVisit = scans.filter((s) => {
      if (!s || !s.scannedAt) return false;
      if (!lastSeen) return true;
      return new Date(s.scannedAt) > lastSeen;
    }).length;

    return NextResponse.json({
      scans,
      newSinceLastVisit,
      retentionDays: 180,
      lastSeenScansAt: lastSeen ? lastSeen.toISOString() : null,
      publicSectionsNote:
        "Scanners can see: name, blood group, city, allergies, conditions, medications, emergency contacts, family doctor, preferred hospital, organ donor, and critical alerts. They cannot see full address, ABHA ID, Health ID, activation code, or PIN.",
    });
  } catch (err) {
    console.error("profile/scans GET", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

/** POST /api/profile/scans — mark scans as reviewed (update lastSeenScansAt) */
export async function POST(req: NextRequest) {
  try {
    const token = cookies().get(PROFILE_SESSION_COOKIE)?.value;
    const session = verifyProfileSessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "mark-reviewed");
    if (action !== "mark-reviewed") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const db = getAdminDb();
    await db.collection("profiles").doc(session.profileId).update({
      lastSeenScansAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("profile/scans POST", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
