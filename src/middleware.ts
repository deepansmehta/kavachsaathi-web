import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/activate",
  "/order",
  "/forgot-pin",
  "/reset-pin",
  "/offline",
  "/doctor",
  "/my-profile",
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Coming-soon / launch timer retired — send old links home
  if (pathname === "/coming-soon" || pathname.startsWith("/coming-soon/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const session = request.cookies.get("kavach_session")?.value === "1";

  if (
    CARD_PATTERN.test(pathname) ||
    EMERGENCY_PATTERN.test(pathname) ||
    ACTIVATE_PATTERN.test(pathname) ||
    pathname === "/my-profile"
  ) {
    return NextResponse.next();
  }

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) || ADMIN_PATTERN.test(pathname);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (session && (pathname === "/login" || pathname === "/forgot-pin")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (session && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!session && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  void isPublic;
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|icons|manifest.json|sw.js|workbox-.+).*)",
  ],
};
