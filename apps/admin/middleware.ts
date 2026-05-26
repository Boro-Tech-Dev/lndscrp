import { requestPublicOrigin } from "@landscrape/auth";
import { SESSION_COOKIE } from "@landscrape/session/cookie";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authEnabled } from "./app/lib/auth/constants";

export function middleware(request: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value?.trim();
  if (!sessionId) {
    const origin = requestPublicOrigin(request, {
      preferredEnv: "ADMIN_BASE_URL",
      devFallback: "http://localhost:3001"
    });
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("returnUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
