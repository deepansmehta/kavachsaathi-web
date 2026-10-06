import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import { NO_STORE_HEADERS } from "@/lib/activationGate";
import { POST as vehiclePost } from "../route";

export const dynamic = "force-dynamic";

/**
 * POST /api/vehicle/link — alias that invokes /api/vehicle with action=link
 * (in-process; no self-HTTP fetch — that hangs under next start / Netlify).
 * When flag OFF → 404 FEATURE_OFF (same as parent).
 */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("vehicleSticker");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }
  const body = await req.json().catch(() => ({}));
  const url = new URL("/api/vehicle", req.url);
  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");
  const forwarded = new NextRequest(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, action: "link" }),
  });
  return vehiclePost(forwarded);
}
