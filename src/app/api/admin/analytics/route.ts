import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Counts = Record<string, number>;

/**
 * GET /api/admin/analytics?days=30&format=json|csv
 * Aggregate counts from analytics_daily (no PII).
 */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("adminAnalytics");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  try {
    const days = Math.min(
      90,
      Math.max(1, Number(req.nextUrl.searchParams.get("days") || 30) || 30)
    );
    const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
    const db = getAdminDb();
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const snap = await db
      .collection("analytics_daily")
      .where("date", ">=", sinceStr)
      .orderBy("date", "asc")
      .get()
      .catch(async () => {
        // Fallback if composite index missing — scan recent docs
        const all = await db.collection("analytics_daily").limit(500).get();
        return {
          docs: all.docs.filter((d) => String(d.data().date || "") >= sinceStr),
        };
      });

    const byDate: Record<
      string,
      { date: string; batch: string; counts: Counts; total: number }
    > = {};
    const totals: Counts = {};

    for (const d of snap.docs) {
      const data = d.data();
      const date = String(data.date || "");
      if (!date) continue;
      const batch = data.batch != null ? String(data.batch) : "all";
      const counts = (data.counts || {}) as Counts;
      const key = `${date}_${batch}`;
      if (!byDate[key]) {
        byDate[key] = { date, batch, counts: {}, total: 0 };
      }
      for (const [k, v] of Object.entries(counts)) {
        const n = Number(v) || 0;
        byDate[key].counts[k] = (byDate[key].counts[k] || 0) + n;
        totals[k] = (totals[k] || 0) + n;
      }
      byDate[key].total += Number(data.total) || 0;
    }

    const rows = Object.values(byDate).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    if (format === "csv") {
      const types = Array.from(
        new Set(rows.flatMap((r) => Object.keys(r.counts)))
      ).sort();
      const header = ["date", "batch", "total", ...types].join(",");
      const lines = rows.map((r) =>
        [
          r.date,
          r.batch,
          String(r.total),
          ...types.map((t) => String(r.counts[t] || 0)),
        ].join(",")
      );
      return new NextResponse([header, ...lines].join("\n"), {
        status: 200,
        headers: {
          ...noStoreHeaders(),
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="kavachsaathi-analytics.csv"',
        },
      });
    }

    return NextResponse.json(
      { days, since: sinceStr, totals, rows },
      { headers: noStoreHeaders() }
    );
  } catch (err) {
    console.error("admin/analytics", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
