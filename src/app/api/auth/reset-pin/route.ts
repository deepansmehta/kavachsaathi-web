import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * POST /api/auth/reset-pin
 * Body: { token, newPinHash }
 * 1. Find user where reset_token === token
 * 2. Check reset_token_expires > Date.now()
 * 3. Update pin_hash, clear reset_token + reset_token_expires
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, newPinHash, validateOnly } = body as {
      token?: string;
      newPinHash?: string;
      validateOnly?: boolean;
    };

    if (!token || typeof token !== "string" || token.length !== 64) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const db = getAdminDb();
    const snaps = await db
      .collection("users")
      .where("reset_token", "==", token)
      .limit(1)
      .get();

    if (snaps.empty) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    const doc = snaps.docs[0];
    const data = doc.data();
    const expires = data.reset_token_expires as number | null;

    if (!expires || expires < Date.now()) {
      return NextResponse.json(
        { error: "Reset link has expired" },
        { status: 400 }
      );
    }

    // Optional: UI can validate token before showing PIN form
    if (validateOnly) {
      return NextResponse.json({
        success: true,
        valid: true,
        name: data.full_name || "",
      });
    }

    if (
      !newPinHash ||
      typeof newPinHash !== "string" ||
      newPinHash.length !== 64 ||
      !/^[a-f0-9]+$/i.test(newPinHash)
    ) {
      return NextResponse.json(
        { error: "newPinHash required" },
        { status: 400 }
      );
    }

    await doc.ref.update({
      pin_hash: newPinHash,
      reset_token: null,
      reset_token_expires: null,
      updated_at: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reset-pin error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      { status: 500 }
    );
  }
}
