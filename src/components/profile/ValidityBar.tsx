"use client";

import { useMemo } from "react";
import {
  buildIcs,
  googleCalendarReminderUrl,
  SITE_URL,
} from "@/lib/config/links";
import { computeValidity } from "@/lib/validity";

type Props = {
  enabled: boolean;
  validFrom?: string | null;
  validTill?: string | null;
  healthId: string;
  name: string;
  onRenew: () => void;
};

/** F46 validity bar + banners for /my-profile */
export function ValidityBar({
  enabled,
  validFrom,
  validTill,
  healthId,
  name,
  onRenew,
}: Props) {
  const v = useMemo(
    () => computeValidity({ validFrom, validTill }),
    [validFrom, validTill]
  );
  if (!enabled || !v.validTill) return null;

  const days = v.daysRemaining ?? 0;
  const pct = Math.max(
    0,
    Math.min(100, ((days > 0 ? days : 0) / 365) * 100)
  );
  let banner: string | null = null;
  if (v.expired && v.ownerFeaturesLocked) {
    banner = "Validity expired — renew to unlock Full Details / PDFs.";
  } else if (v.expired && v.inGrace) {
    banner = "Card expired — grace period active. Renew soon.";
  } else if (days <= 7) {
    banner = `Expires in ${days} day(s). Renew now.`;
  } else if (days <= 30) {
    banner = `Expires in ${days} days.`;
  }

  const start = v.validTill;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const calUrl = googleCalendarReminderUrl({
    title: "Renew KavachSaathi card",
    details: `Renew ${healthId} (${name}) at ${SITE_URL}`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  });

  const downloadIcs = () => {
    const ics = buildIcs({
      title: "Renew KavachSaathi card",
      description: `Renew ${healthId}`,
      start,
      end,
    });
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kavachsaathi-renewal.ics";
    a.click();
  };

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-gold-border bg-kavach-s1/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-rajdhani text-sm font-bold uppercase tracking-wider text-gold">
          Card validity
        </p>
        <p className="font-mono text-xs text-cream-soft">
          till {v.validTill.toLocaleDateString("en-IN")}
          {days != null ? ` · ${days}d` : ""}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-kavach-black">
        <div
          className="h-full rounded-full bg-gold"
          style={{ width: `${pct}%` }}
        />
      </div>
      {banner && (
        <p className="rounded-lg bg-gold-faint px-3 py-2 text-sm text-gold">
          {banner}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRenew}
          className="rounded-lg border border-gold px-3 py-2 text-sm text-gold"
        >
          Request renewal (WhatsApp)
        </button>
        <a
          href={calUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-gold-border px-3 py-2 text-sm text-cream-soft"
        >
          Add calendar reminder
        </a>
        <button
          type="button"
          onClick={downloadIcs}
          className="rounded-lg border border-gold-border px-3 py-2 text-sm text-cream-soft"
        >
          Download .ics
        </button>
      </div>
    </div>
  );
}
