import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LAUNCH_PREVIEW_COOKIE,
  PRELAUNCH_PREVIEW_COOKIE_MAX_AGE_SEC,
  isPrelaunchPreviewActive,
  isSiteLaunched,
  previewParamMatchesSecret,
} from "@/lib/launchConfig";

/**
 * Pre-launch gate uses the SAME instant as ACTIVATION_OPENS_AT
 * (via isSiteLaunched → getSiteLaunchAtMs). Opens automatically at that
 * moment with no redeploy. Emergency: SITE_PRELAUNCH_FORCE=open|closed.
 *
 * Always allowed before launch (no preview needed):
 *   /card /e /emergency — QR emergency / activation countdown
 *   /api/card /api/uploads /api/full-details /api/forms /api/features
 *   /api/alert-family /api/scan /api/log-scan /api/emergency
 *   Phase 2/3 APIs (handlers still return 404 when flags OFF)
 *   /admin + /api/admin — allowlisted Google admins only (handler enforces)
 *
 * Gated until launch (→ /coming-soon or 503):
 *   /my-profile, /hospital, /org, marketing pages
 *   /api/profile/*, other non-allowlisted APIs
 */

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/activate",
  "/order",
  "/forgot-pin",
  "/reset-pin",
  "/offline",
  "/doctor",
  "/coming-soon",
  "/my-profile",
  "/privacy",
  "/terms",
  "/schemes", // F22 scheme guide — always open (public health info)
];

const CARD_PATTERN = /^\/card\//;
const EMERGENCY_PATTERN = /^\/(e|emergency)\//;
const ACTIVATE_PATTERN = /^\/activate\//;
const ADMIN_PATTERN = /^\/admin/;

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/my-card",
  "/scan-history",
];

function clearPreview(res: NextResponse) {
  for (const name of [
    LAUNCH_PREVIEW_COOKIE,
    "kavach_preview_v2",
    "kavach_preview",
  ]) {
    res.cookies.set(name, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0,
    });
  }
  return res;
}

function withPreviewCookie(res: NextResponse) {
  res.cookies.set(LAUNCH_PREVIEW_COOKIE, "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PRELAUNCH_PREVIEW_COOKIE_MAX_AGE_SEC,
  });
  return res;
}

function isPreLaunchApiAllowed(pathname: string): boolean {
  return (
    pathname.startsWith("/api/card/") ||
    // Legacy activate paths must reach handlers (return 410 Gone)
    pathname === "/api/auth/activate" ||
    pathname === "/api/activate-card" ||
    pathname.startsWith("/api/uploads/") ||
    pathname === "/api/full-details" ||
    pathname.startsWith("/api/forms/") ||
    pathname === "/api/features" ||
    pathname === "/api/alert-family" ||
    pathname === "/api/scan" ||
    pathname === "/api/log-scan" ||
    pathname === "/api/emergency" ||
    pathname === "/api/cashless-timer" ||
    pathname === "/api/vault" ||
    pathname.startsWith("/api/vault/") ||
    pathname === "/api/family" ||
    pathname.startsWith("/api/family/") ||
    pathname === "/api/hospital" ||
    pathname.startsWith("/api/hospital/") ||
    pathname === "/api/org" ||
    pathname.startsWith("/api/org/") ||
    pathname === "/api/donor-directive" ||
    pathname.startsWith("/api/donor-directive/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/") ||
    pathname === "/api/profile/renewal-request" ||
    pathname === "/api/profile/lost-card" ||
    pathname === "/api/profile/data-export" ||
    pathname === "/api/profile/fhir-export" ||
    pathname === "/api/profile/hospital-consent" ||
    pathname === "/api/profile/sticker-orders" ||
    pathname.startsWith("/api/profile/sticker-orders/") ||
    pathname === "/api/feedback" ||
    pathname.startsWith("/api/feedback/") ||
    pathname === "/api/referral" ||
    pathname.startsWith("/api/referral/") ||
    pathname === "/api/vehicle" ||
    pathname.startsWith("/api/vehicle/") ||
    // Pack 2 — Patient Ease (handlers still 404 when flags OFF)
    pathname === "/api/coverage" ||
    pathname.startsWith("/api/coverage/") ||
    pathname === "/api/discharge-checklist" ||
    pathname.startsWith("/api/discharge-checklist/") ||
    pathname === "/api/document-pack" ||
    pathname.startsWith("/api/document-pack/") ||
    pathname === "/api/bill-letter" ||
    pathname.startsWith("/api/bill-letter/") ||
    pathname === "/api/claim-deadline" ||
    pathname.startsWith("/api/claim-deadline/") ||
    pathname === "/api/attendant-pass" ||
    pathname.startsWith("/api/attendant-pass/") ||
    pathname.startsWith("/api/pass/") ||
    pathname === "/api/doctor-summary" ||
    pathname.startsWith("/api/doctor-summary/") ||
    pathname === "/api/follow-up" ||
    pathname.startsWith("/api/follow-up/") ||
    pathname === "/api/need-blood" ||
    pathname.startsWith("/api/need-blood/") ||
    pathname === "/api/disclosure-vault" ||
    pathname.startsWith("/api/disclosure-vault/") ||
    // Launch-reveal / marketing pack orders
    pathname === "/api/orders"
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const previewRaw = request.nextUrl.searchParams.get("preview");
  const turnOffPreview =
    previewRaw === "off" || previewRaw === "clear" || previewRaw === "0";
  const launched = isSiteLaunched();

  if (turnOffPreview) {
    const soon = new URL("/coming-soon", request.url);
    return clearPreview(NextResponse.redirect(soon));
  }

  const previewParam = previewParamMatchesSecret(previewRaw);
  const previewCookie =
    request.cookies.get(LAUNCH_PREVIEW_COOKIE)?.value === "1";
  const preview =
    !launched &&
    isPrelaunchPreviewActive({
      previewParam: previewRaw,
      cookieValue: previewCookie ? "1" : null,
    });

  // ── Pre-launch (before ACTIVATION_OPENS_AT / SITE_PRELAUNCH_FORCE) ─────
  if (!launched && !preview) {
    if (pathname === "/coming-soon" || pathname.startsWith("/coming-soon/")) {
      return clearPreview(NextResponse.next());
    }

    // Admin UI + API always reachable; Google allowlist enforced in handlers
    if (ADMIN_PATTERN.test(pathname) || pathname.startsWith("/api/admin")) {
      return NextResponse.next();
    }

    // Owner launch-reveal rehearsal: /?replayLaunch=1 before launch day
    if (
      (pathname === "/" || pathname === "") &&
      request.nextUrl.searchParams.get("replayLaunch") === "1"
    ) {
      return NextResponse.next();
    }

    if (CARD_PATTERN.test(pathname) || EMERGENCY_PATTERN.test(pathname)) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-kavach-lite", "1");
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // /schemes and /pass/ — always open (public health info + attendant pass)
    if (pathname === "/schemes" || pathname.startsWith("/pass/")) {
      return NextResponse.next();
    }

    // Public Pack 2 pages (scheme guide + attendant pass link)
    if (pathname === "/schemes" || pathname.startsWith("/schemes/")) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/pass/")) {
      return NextResponse.next();
    }
    // PWA offline shell (F55) — must work without launch / preview
    if (pathname === "/offline" || pathname.startsWith("/offline/")) {
      return NextResponse.next();
    }

    if (isPreLaunchApiAllowed(pathname)) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Site not launched yet", code: "PRE_LAUNCH" },
        { status: 503 }
      );
    }

    return clearPreview(
      NextResponse.redirect(new URL("/coming-soon", request.url))
    );
  }

  // Only set cookie when secret matched on this request AND still pre-launch
  const attachPreview = !launched && previewParam;

  // ── Post-launch (or pre-launch preview) auth routing ───────────────────
  const session = request.cookies.get("kavach_session")?.value === "1";
  const requestHeaders = new Headers(request.headers);

  const finish = (res: NextResponse) => {
    if (launched) return clearPreview(res);
    return attachPreview ? withPreviewCookie(res) : res;
  };

  if (CARD_PATTERN.test(pathname) || EMERGENCY_PATTERN.test(pathname)) {
    requestHeaders.set("x-kavach-lite", "1");
    const res = NextResponse.next({
      request: { headers: requestHeaders },
    });
    return finish(res);
  }

  if (
    ACTIVATE_PATTERN.test(pathname) ||
    pathname === "/my-profile" ||
    pathname === "/hospital" ||
    pathname === "/org" ||
    ADMIN_PATTERN.test(pathname)
  ) {
    return finish(NextResponse.next());
  }

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) || ADMIN_PATTERN.test(pathname);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (session && (pathname === "/login" || pathname === "/forgot-pin")) {
    return finish(NextResponse.redirect(new URL("/dashboard", request.url)));
  }
  if (session && pathname === "/") {
    return finish(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  if (!session && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return finish(NextResponse.redirect(loginUrl));
  }

  void isPublic;
  return finish(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|icons|manifest.json|sw.js|workbox-.+).*)",
  ],
};
