import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LAUNCH_PREVIEW_COOKIE,
  LAUNCH_PREVIEW_SECRET,
} from "@/lib/launchConfig";

/**
 * Hardcoded launch instant (11 Oct 2026, 12:00 PM IST).
 * Do NOT rely on env here — Netlify Edge must always gate until this moment.
 */
const LAUNCH_AT_MS = Date.parse("2026-10-11T12:00:00+05:30");

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

function isLaunchedNow() {
  return Date.now() >= LAUNCH_AT_MS;
}

function clearPreview(res: NextResponse) {
  res.cookies.set(LAUNCH_PREVIEW_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}

function withPreviewCookie(res: NextResponse) {
  res.cookies.set(LAUNCH_PREVIEW_COOKIE, "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // Short-lived so QA doesn't accidentally leave the gate open for weeks
    maxAge: 60 * 60 * 2,
  });
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const previewRaw = request.nextUrl.searchParams.get("preview");
  const turnOffPreview =
    previewRaw === "off" || previewRaw === "clear" || previewRaw === "0";
  const previewParam = previewRaw === LAUNCH_PREVIEW_SECRET;
  const previewCookie =
    request.cookies.get(LAUNCH_PREVIEW_COOKIE)?.value === "1";

  // Explicitly clear preview unlock
  if (turnOffPreview) {
    const soon = new URL("/coming-soon", request.url);
    return clearPreview(NextResponse.redirect(soon));
  }

  const preview = previewParam || previewCookie;

  // ── Launch gate (before 11 Oct 2026, 12:00 PM IST) ─────────────────────
  if (!isLaunchedNow() && !preview) {
    if (pathname === "/coming-soon") {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Site not launched yet", code: "PRE_LAUNCH" },
        { status: 503 }
      );
    }

    return NextResponse.redirect(new URL("/coming-soon", request.url));
  }

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

  void isPublic;
  const res = NextResponse.next();
  return attachPreview ? withPreviewCookie(res) : res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|icons|manifest.json|sw.js|workbox-.+).*)",
  ],
};
