import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import { NO_STORE_HEADERS } from "@/lib/activationGate";

export const dynamic = "force-dynamic";

/**
 * POST /api/vehicle/link — alias that forwards to /api/vehicle with action=link.
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
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, action: "link" }),
  }).then(async (r) => {
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: NO_STORE_HEADERS,
    });
  });
}
