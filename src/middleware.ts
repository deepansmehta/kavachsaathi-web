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
];

const EMERGENCY_PATTERN = /^\/e\//;

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/my-card",
  "/scan-history",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("kavach_session")?.value === "1";

  // Emergency pages always public
  if (EMERGENCY_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // Logged in → skip login/forgot-pin/home
  if (session && (pathname === "/login" || pathname === "/forgot-pin")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (session && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Not logged in + protected → /login
  if (!session && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!session && !isPublic) {
    // Allow other public-ish assets; only force login for known protected area
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.+|api).*)",
  ],
};
