import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isLaunched,
  LAUNCH_PREVIEW_COOKIE,
  LAUNCH_PREVIEW_SECRET,
} from "@/lib/launchConfig";

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
];

const EMERGENCY_PATTERN = /^\/e\//;

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/my-card",
  "/scan-history",
];

function withPreviewCookie(res: NextResponse) {
  res.cookies.set(LAUNCH_PREVIEW_COOKIE, "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // Until a bit after launch — enough for QA sessions
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const previewParam =
    request.nextUrl.searchParams.get("preview") === LAUNCH_PREVIEW_SECRET;
  const previewCookie =
    request.cookies.get(LAUNCH_PREVIEW_COOKIE)?.value === "1";
  const preview = previewParam || previewCookie;

  // ── Launch gate (before 11 Oct 2026, 6:00 PM IST) ──────────────────────
  if (!isLaunched() && !preview) {
    if (pathname === "/coming-soon") {
      return NextResponse.next();
    }

    // Block API calls too — no feature usable pre-launch
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Site not launched yet", code: "PRE_LAUNCH" },
        { status: 503 }
      );
    }

    const soon = new URL("/coming-soon", request.url);
    return NextResponse.redirect(soon);
  }

  // Preview unlock via query → set cookie so further navigations stay open
  const attachPreview = previewParam;

  // ── Post-launch (or preview) auth routing ──────────────────────────────
  const session = request.cookies.get("kavach_session")?.value === "1";

  if (EMERGENCY_PATTERN.test(pathname)) {
    const res = NextResponse.next();
    return attachPreview ? withPreviewCookie(res) : res;
  }

  const isPublic = PUBLIC_ROUTES.includes(pathname);
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

  if (!session && !isPublic) {
    // Unknown routes: allow through (404 handled by app)
  }

  const res = NextResponse.next();
  return attachPreview ? withPreviewCookie(res) : res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|icons|manifest.json|sw.js|workbox-.+).*)",
  ],
};
