import { NextRequest, NextResponse } from "next/server";
import { isFirebaseConfigured } from "@/lib/firebase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { activation_code, user_uid } = body as {
      activation_code?: string;
      user_uid?: string;
    };
    if (!activation_code || !user_uid) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (!isFirebaseConfigured || !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({ ok: true, demo: true });
    }

    const { logScanAdmin } = await import("@/lib/firebase-admin");
    await logScanAdmin(activation_code, user_uid);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
