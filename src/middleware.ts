import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LAUNCH_PREVIEW_COOKIE,
  LAUNCH_PREVIEW_SECRET,
  isSiteLaunched,
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
  for (const name of [LAUNCH_PREVIEW_COOKIE, "kavach_preview"]) {
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
    maxAge: 60 * 60 * 2,
  });
  return res;
}

function isPreLaunchApiAllowed(pathname: string): boolean {
  return (
    pathname.startsWith("/api/card/") ||
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
    pathname.startsWith("/api/admin/")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const previewRaw = request.nextUrl.searchParams.get("preview");
  const turnOffPreview =
    previewRaw === "off" || previewRaw === "clear" || previewRaw === "0";
  const previewParam = previewRaw === LAUNCH_PREVIEW_SECRET;
  const previewCookie =
    request.cookies.get(LAUNCH_PREVIEW_COOKIE)?.value === "1";

  if (turnOffPreview) {
    const soon = new URL("/coming-soon", request.url);
    return clearPreview(NextResponse.redirect(soon));
  }

  const preview = previewParam || previewCookie;
  const launched = isSiteLaunched();

  // ── Pre-launch (before ACTIVATION_OPENS_AT / SITE_PRELAUNCH_FORCE) ─────
  if (!launched && !preview) {
    if (pathname === "/coming-soon" || pathname.startsWith("/coming-soon/")) {
      return clearPreview(NextResponse.next());
    }

    // Admin UI + API always reachable; Google allowlist enforced in handlers
    if (ADMIN_PATTERN.test(pathname) || pathname.startsWith("/api/admin")) {
      return NextResponse.next();
    }

    if (CARD_PATTERN.test(pathname) || EMERGENCY_PATTERN.test(pathname)) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-kavach-lite", "1");
      return NextResponse.next({ request: { headers: requestHeaders } });
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

  const attachPreview = previewParam;

  // ── Post-launch (or preview) auth routing ──────────────────────────────
  const session = request.cookies.get("kavach_session")?.value === "1";
  const requestHeaders = new Headers(request.headers);

  if (CARD_PATTERN.test(pathname) || EMERGENCY_PATTERN.test(pathname)) {
    requestHeaders.set("x-kavach-lite", "1");
    const res = NextResponse.next({
      request: { headers: requestHeaders },
    });
    return attachPreview ? withPreviewCookie(res) : res;
  }

  if (
    ACTIVATE_PATTERN.test(pathname) ||
    pathname === "/my-profile" ||
    pathname === "/hospital" ||
    pathname === "/org" ||
    ADMIN_PATTERN.test(pathname)
  ) {
    const res = NextResponse.next();
    return attachPreview ? withPreviewCookie(res) : res;
  }

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) || ADMIN_PATTERN.test(pathname);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (session && (pathname === "/login" || pathname === "/forgot-pin")) {
    const res = NextResponse.redirect(new URL("/dashboard", request.url));
    return attachPreview ? withPreviewCookie(res) : res;
  }
  if (session && pathname === "/") {
    const res = NextResponse.redirect(new URL("/dashboard", request.url));
    return attachPreview ? withPreviewCookie(res) : res;
  }

  if (!session && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const res = NextResponse.redirect(loginUrl);
    return attachPreview ? withPreviewCookie(res) : res;
  }

  void isPublic;
  const res = NextResponse.next();
  return attachPreview ? withPreviewCookie(res) : res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|icons|manifest.json|sw.js|workbox-.+).*)",
  ],
};
