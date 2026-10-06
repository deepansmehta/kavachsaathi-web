"use client";

import { useCallback, useMemo, useState } from "react";

export type WallpaperProfile = {
  name: string;
  bloodGroup: string;
  allergies: string[];
  /** Critical flags / alert tags — medical only, no IDs */
  criticalTags: string[];
  contacts: { name: string; phone: string }[];
};

const SIZES = [
  { id: "1080x2340", w: 1080, h: 2340, label: "1080 × 2340" },
  { id: "1170x2532", w: 1170, h: 2532, label: "1170 × 2532" },
] as const;

type SizeId = (typeof SIZES)[number]["id"];

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, cy);
    cy += lineHeight;
  }
  return cy;
}

function drawWallpaper(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  data: WallpaperProfile
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = w;
  canvas.height = h;

  // Dark background
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, w, h);

  // Gold top accent bar
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "#B8860B");
  grad.addColorStop(0.5, "#FCE49A");
  grad.addColorStop(1, "#D4AF37");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, Math.round(h * 0.012));

  const pad = Math.round(w * 0.08);
  const maxText = w - pad * 2;
  let y = Math.round(h * 0.08);

  // Brand
  ctx.fillStyle = "#D4AF37";
  ctx.font = `700 ${Math.round(w * 0.035)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("KAVACHSAATHI", w / 2, y);
  y += Math.round(h * 0.028);
  ctx.fillStyle = "#A8A59C";
  ctx.font = `600 ${Math.round(w * 0.022)}px system-ui, sans-serif`;
  ctx.fillText("EMERGENCY MEDICAL INFO", w / 2, y);
  y += Math.round(h * 0.05);

  // Name
  ctx.fillStyle = "#F0EEE8";
  ctx.font = `800 ${Math.round(w * 0.07)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  y = wrapText(ctx, data.name || "—", w / 2, y, maxText, Math.round(w * 0.08));
  y += Math.round(h * 0.02);

  // Blood group
  ctx.fillStyle = "#D4AF37";
  ctx.font = `800 ${Math.round(w * 0.14)}px system-ui, sans-serif`;
  ctx.fillText(data.bloodGroup || "—", w / 2, y);
  y += Math.round(h * 0.06);

  ctx.textAlign = "left";

  const sectionTitle = (title: string) => {
    ctx.fillStyle = "#D4AF37";
    ctx.font = `700 ${Math.round(w * 0.028)}px system-ui, sans-serif`;
    ctx.fillText(title.toUpperCase(), pad, y);
    y += Math.round(h * 0.028);
  };

  const sectionBody = (text: string) => {
    ctx.fillStyle = "#F0EEE8";
    ctx.font = `600 ${Math.round(w * 0.038)}px system-ui, sans-serif`;
    y = wrapText(ctx, text, pad, y, maxText, Math.round(w * 0.048));
    y += Math.round(h * 0.035);
  };

  // Allergies
  sectionTitle("Allergies");
  sectionBody(
    data.allergies.length > 0 ? data.allergies.join(", ") : "None reported"
  );

  // Critical flags
  sectionTitle("Critical flags");
  sectionBody(
    data.criticalTags.length > 0
      ? data.criticalTags.join(" · ")
      : "None reported"
  );

  // Contacts (max 2)
  sectionTitle("Emergency contacts");
  const contacts = data.contacts.slice(0, 2);
  if (contacts.length === 0) {
    sectionBody("None listed");
  } else {
    for (const c of contacts) {
      ctx.fillStyle = "#F0EEE8";
      ctx.font = `700 ${Math.round(w * 0.04)}px system-ui, sans-serif`;
      y = wrapText(
        ctx,
        c.name || "Contact",
        pad,
        y,
        maxText,
        Math.round(w * 0.05)
      );
      ctx.fillStyle = "#FCE49A";
      ctx.font = `600 ${Math.round(w * 0.045)}px system-ui, sans-serif`;
      y = wrapText(
        ctx,
        c.phone || "—",
        pad,
        y,
        maxText,
        Math.round(w * 0.055)
      );
      y += Math.round(h * 0.025);
    }
  }

  // Footer
  const footerY = h - Math.round(h * 0.06);
  ctx.fillStyle = "rgba(212,175,55,0.35)";
  ctx.fillRect(pad, footerY - Math.round(h * 0.04), maxText, 2);
  ctx.fillStyle = "#D4AF37";
  ctx.font = `600 ${Math.round(w * 0.028)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Scan my KavachSaathi card for details", w / 2, footerY);
}

/**
 * Client-only emergency lock-screen wallpaper generator.
 * NEVER includes ID numbers, address, insurance, policy, Aadhaar, or PIN.
 */
export function EmergencyWallpaper({
  featureOn,
  profile,
}: {
  featureOn: boolean;
  profile: WallpaperProfile;
}) {
  const [sizeId, setSizeId] = useState<SizeId>("1080x2340");
  const [privacyAck, setPrivacyAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const size = useMemo(
    () => SIZES.find((s) => s.id === sizeId) || SIZES[0],
    [sizeId]
  );

  const download = useCallback(() => {
    if (!privacyAck) {
      setErr("Please acknowledge the privacy note before downloading.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      drawWallpaper(canvas, size.w, size.h, {
        name: profile.name,
        bloodGroup: profile.bloodGroup,
        allergies: profile.allergies,
        criticalTags: profile.criticalTags,
        contacts: profile.contacts.slice(0, 2).map((c) => ({
          name: c.name,
          phone: c.phone,
        })),
      });

      canvas.toBlob(
        (blob) => {
          setBusy(false);
          if (!blob) {
            setErr("Could not generate image.");
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `kavachsaathi-emergency-${size.id}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        },
        "image/png"
      );
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Failed to generate wallpaper");
    }
  }, [privacyAck, profile, size]);

  if (!featureOn) return null;

  return (
    <div
      className="space-y-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5 no-print"
      data-testid="emergency-wallpaper"
    >
      <h2 className="text-sm uppercase tracking-wider text-[var(--gold)]">
        Create emergency wallpaper
      </h2>
      <p className="text-xs text-[var(--text-soft)]">
        Generate a lock-screen image with essential emergency info. Created on
        your device — nothing is uploaded.
      </p>

      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
        <p className="text-sm text-amber-100">
          Privacy note: This wallpaper will show your name, blood group,
          allergies, critical medical flags, and up to two emergency contact
          names and phone numbers. It will{" "}
          <strong>not</strong> include Health ID, address, insurance, policy,
          Aadhaar, or PIN. Anyone who sees your lock screen can read this.
        </p>
        <label className="mt-3 flex items-start gap-2 text-sm text-amber-50">
          <input
            type="checkbox"
            className="mt-1"
            checked={privacyAck}
            onChange={(e) => {
              setPrivacyAck(e.target.checked);
              setErr("");
            }}
          />
          <span>I understand and want to download this wallpaper</span>
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--gold)]">
          Phone size
        </p>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSizeId(s.id)}
              className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm ${
                sizeId === s.id
                  ? "border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold)]"
                  : "border-[var(--gold-border)] text-[var(--text-soft)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      <button
        type="button"
        disabled={busy || !privacyAck}
        onClick={download}
        className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#FCE49A] px-4 py-3 text-sm font-bold text-[#0a0a08] disabled:opacity-40"
      >
        {busy ? "Generating…" : "Download PNG wallpaper"}
      </button>
    </div>
  );
}
