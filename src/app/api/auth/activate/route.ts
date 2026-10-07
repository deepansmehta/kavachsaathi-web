import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Legacy Auth-based activation (status=active + user_uid, users/{uid} profile).
 * Disabled — caused partial activations (A0001) without the 7-step profiles path.
 * Use POST /api/card/activate via the card wizard only.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This activation path is retired. Scan your QR and use the 7-step card wizard.",
      code: "LEGACY_ACTIVATE_GONE",
      use: "/card/{health_id}",
    },
    { status: 410 }
  );
}

export async function GET() {
  return POST();
}
