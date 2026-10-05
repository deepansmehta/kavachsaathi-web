import { NextRequest, NextResponse } from "next/server";
import { loadFeatureFlags, saveFeatureFlags } from "@/lib/features/server";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/features/flags";
import { getAdminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function adminEmails(): Set<string> {
  const raw =
    process.env.ADMIN_EMAILS ||
    "gdmtechnoworld@gmail.com,mehtadeepansh6@gmail.com";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** GET — public feature flags (for UI gating) */
export async function GET() {
  const flags = await loadFeatureFlags();
  return NextResponse.json(
    { flags },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** PATCH — admin toggle (Bearer Firebase ID token) */
export async function PATCH(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const email = (decoded.email || "").toLowerCase();
    if (!email || !adminEmails().has(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const patch: Partial<Record<FeatureKey, boolean>> = {};
    for (const key of FEATURE_KEYS) {
      if (typeof body?.[key] === "boolean") patch[key] = body[key];
      if (body?.flags && typeof body.flags[key] === "boolean") {
        patch[key] = body.flags[key];
      }
    }
    const flags = await saveFeatureFlags(patch, email);
    return NextResponse.json({ flags });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
