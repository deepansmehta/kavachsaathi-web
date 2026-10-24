import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireFeature } from "@/lib/features/server";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InsurerEntry = { name: string; website: string };

let cache: { at: number; list: InsurerEntry[] } | null = null;
const TTL_MS = 5 * 60_000;

function loadInsurers(): InsurerEntry[] {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.list;
  const file = path.join(process.cwd(), "data", "insurers.json");
  let list: InsurerEntry[] = [];
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      list = parsed
        .map((row) => ({
          name: String((row as InsurerEntry)?.name || "").trim(),
          website: String((row as InsurerEntry)?.website || "").trim(),
        }))
        .filter((r) => r.name);
    }
  } catch {
    list = [];
  }
  cache = { at: now, list };
  return list;
}

/** GET /api/policies/insurers — insurer name + official website quick links */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("insurerLinks");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  let list = loadInsurers();
  if (q) {
    list = list.filter((i) => i.name.toLowerCase().includes(q));
  }

  return NextResponse.json({ insurers: list }, { headers: noStoreHeaders() });
}
