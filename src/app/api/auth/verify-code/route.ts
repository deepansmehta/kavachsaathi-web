import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

/** Verify activation code (public) */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code || String(code).length !== 4) {
      return NextResponse.json({ valid: false, error: "Enter 4-digit code" });
    }

    const id = String(code).trim().padStart(4, "0");
    const db = getAdminDb();
    const snap = await db.collection("cards").doc(id).get();

    if (!snap.exists) {
      return NextResponse.json({
        valid: false,
        error: "Card not found. Check the code on the back of your card.",
      });
    }

    const data = snap.data()!;
    if (data.status === "active") {
      return NextResponse.json({
        valid: false,
        error: "This card has already been activated.",
      });
    }

    return NextResponse.json({
      valid: true,
      card: {
        activation_code: snap.id,
        health_id: data.health_id,
        tier: data.tier || "STANDARD",
        status: data.status,
      },
    });
  } catch (err) {
    console.error("verify-code", err);
    return NextResponse.json({
      valid: false,
      error:
        err instanceof Error
          ? `Server error: ${err.message}`
          : "Could not verify code. Please try again.",
    });
  }
}
