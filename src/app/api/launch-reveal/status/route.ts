import { NextRequest, NextResponse } from "next/server";
import {
  LAUNCH_PREVIEW_COOKIE,
  getSiteLaunchNow,
  isPrelaunchPreviewActive,
} from "@/lib/launchConfig";
import {
  LAUNCH_REVEAL_DAY_END_MS,
  LAUNCH_REVEAL_DAY_START_MS,
  LAUNCH_REVEAL_NEVER_AFTER_MS,
  isAfterRevealEra,
  isBeforeLaunchInstant,
  isLaunchRevealDay,
  isLaunchRevealPathAllowed,
} from "@/lib/launchReveal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/launch-reveal/status?path=/
 * Server-authoritative gate for whether the reveal bundle may load.
 */
export async function GET(req: NextRequest) {
  const now = getSiteLaunchNow();
  const nowMs = now.getTime();
  const path = String(req.nextUrl.searchParams.get("path") || "/");
  const pathOk = isLaunchRevealPathAllowed(path);
  const previewCookie =
    req.cookies.get(LAUNCH_PREVIEW_COOKIE)?.value === "1";
  const preview = isPrelaunchPreviewActive({
    cookieValue: previewCookie ? "1" : null,
    now,
  });
  const beforeLaunch = isBeforeLaunchInstant(nowMs);
  const inWindow = isLaunchRevealDay(nowMs);
  const neverAfter = isAfterRevealEra(nowMs);
  /** Owner rehearsal: preview cookie + before launch + home path only. */
  const canReplay =
    beforeLaunch && preview && (path === "/" || path === "");

  return NextResponse.json(
    {
      ok: true,
      nowMs,
      nowIso: now.toISOString(),
      pathOk,
      inWindow,
      beforeLaunch,
      neverAfter,
      canReplay,
      /** Client may lazy-load the reveal module. */
      mayLoadBundle: pathOk && !neverAfter && (inWindow || canReplay),
      windowStartMs: LAUNCH_REVEAL_DAY_START_MS,
      windowEndMs: LAUNCH_REVEAL_DAY_END_MS,
      neverAfterMs: LAUNCH_REVEAL_NEVER_AFTER_MS,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
