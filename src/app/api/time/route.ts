import { NextResponse } from "next/server";
import { getSiteLaunchNow } from "@/lib/launchConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/time — authoritative server clock for launch reveal / coming-soon.
 * Never trust the device clock for gate decisions.
 */
export async function GET() {
  const now = getSiteLaunchNow();
  return NextResponse.json(
    {
      ok: true,
      nowMs: now.getTime(),
      nowIso: now.toISOString(),
      tz: "Asia/Kolkata",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
