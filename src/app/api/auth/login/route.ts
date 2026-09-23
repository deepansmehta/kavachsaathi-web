import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

/**
 * POST /api/auth/login
 * Body: { identifier, pinHash, loginType: "phone" | "health_id" }
 * 1. Find user by phone OR health_id (via cards → users)
 * 2. Compare pin_hash
 * 3. return { customToken }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, pinHash, loginType } = body as {
      identifier?: string;
      pinHash?: string;
      loginType?: "phone" | "health_id";
    };

    if (!identifier || !pinHash || !loginType) {
      return NextResponse.json(
        { error: "Missing identifier, pinHash, or loginType" },
        { status: 400 }
      );
    }

    if (pinHash.length !== 64 || !/^[a-f0-9]+$/i.test(pinHash)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const db = getAdminDb();
    let userUid: string | null = null;
    let userDoc: Record<string, unknown> | null = null;

    if (loginType === "phone") {
      const phone = identifier.replace(/\D/g, "").slice(-10);
      const snaps = await db
        .collection("users")
        .where("phone", "==", phone)
        .limit(1)
        .get();
      if (!snaps.empty) {
        userUid = snaps.docs[0].id;
        userDoc = snaps.docs[0].data();
      }
    } else {
      // Health ID + PIN — prefer cards collection, then users fallback
      const healthId = identifier.trim().toUpperCase();
      const cardSnaps = await db
        .collection("cards")
        .where("health_id", "==", healthId)
        .limit(1)
        .get();

      if (!cardSnaps.empty) {
        const card = cardSnaps.docs[0].data();
        if (card.user_uid) {
          const userSnap = await db
            .collection("users")
            .doc(String(card.user_uid))
            .get();
          if (userSnap.exists) {
            userUid = userSnap.id;
            userDoc = userSnap.data() || null;
          }
        }
      }

      if (!userUid) {
        const snaps = await db
          .collection("users")
          .where("health_id", "==", healthId)
          .limit(1)
          .get();
        if (!snaps.empty) {
          userUid = snaps.docs[0].id;
          userDoc = snaps.docs[0].data();
        }
      }
    }

    if (!userUid || !userDoc) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!userDoc.pin_hash || userDoc.pin_hash !== pinHash) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const customToken = await getAdminAuth().createCustomToken(userUid);
    return NextResponse.json({ customToken });
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed" },
      { status: 500 }
    );
  }
}
