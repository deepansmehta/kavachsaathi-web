"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FEATURE_GROUPS,
  FEATURE_INVENTORY,
  TOTAL_FEATURES,
  type InventoryRow,
} from "@/lib/features/inventory";
import type { FeatureKey } from "@/lib/features/flags";

type Flags = Partial<Record<FeatureKey, boolean>>;

function statusFor(row: InventoryRow, flags: Flags): "LIVE" | "OFF" {
  if (row.flag === "always-on") return "LIVE";
  return flags[row.flag] === true ? "LIVE" : "OFF";
}

export default function AdminFeaturesInventoryPage() {
  const [flags, setFlags] = useState<Flags>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((j) => {
        setFlags(j.flags || {});
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const liveCount = useMemo(() => {
    return FEATURE_INVENTORY.filter((r) => statusFor(r, flags) === "LIVE")
      .length;
  }, [flags]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-[#0c0c0a] px-4 py-8 text-[#F0EEE8]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-[#D4AF37]">
            ← Admin
          </Link>
          <h1 className="mt-2 font-[Rajdhani] text-3xl font-bold text-[#D4AF37]">
            Feature inventory
          </h1>
          <p className="mt-1 text-sm text-[#A8A59C]">
            All {TOTAL_FEATURES} features · source{" "}
            <code className="text-xs">docs/FEATURES.md</code> /{" "}
            <code className="text-xs">src/lib/features/inventory.ts</code>
          </p>
        </div>
        <div className="rounded-xl border border-[#D4AF37]/40 bg-[#141410] px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-wider text-[#A8A59C]">
            Live
          </p>
          <p className="font-[Rajdhani] text-3xl font-bold text-[#FCE49A]">
            {loaded ? liveCount : "…"} / {TOTAL_FEATURES}
          </p>
        </div>
      </div>

      {FEATURE_GROUPS.map((g) => {
        const rows = FEATURE_INVENTORY.filter((r) => r.group === g.id);
        const groupLive = rows.filter(
          (r) => statusFor(r, flags) === "LIVE"
        ).length;
        return (
          <section key={g.id} className="mb-10">
            <h2 className="mb-3 flex flex-wrap items-baseline gap-2 font-[Rajdhani] text-xl font-semibold text-[#FCE49A]">
              {g.title}
              <span className="text-sm font-normal text-[#A8A59C]">
                {groupLive}/{rows.length} live
              </span>
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[#D4AF37]/25">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-[#141410] text-[#A8A59C]">
                  <tr>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">What</th>
                    <th className="px-3 py-2 font-medium">Where</th>
                    <th className="px-3 py-2 font-medium">Flag</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Test</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = statusFor(r, flags);
                    return (
                      <tr
                        key={r.id}
                        className="border-t border-[#D4AF37]/15 align-top"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-[#D4AF37]">
                          {r.id}
                        </td>
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-[#C8C5BB]">{r.summary}</td>
                        <td className="px-3 py-2 font-mono text-xs text-[#A8A59C]">
                          {r.where}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.flag}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              st === "LIVE"
                                ? "rounded bg-emerald-900/50 px-2 py-0.5 text-xs font-bold text-emerald-300"
                                : "rounded bg-stone-800 px-2 py-0.5 text-xs font-bold text-stone-400"
                            }
                          >
                            {loaded ? st : "…"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-[#A8A59C]">
                          {r.test.replace(/^scripts\//, "")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </main>
  );
}
