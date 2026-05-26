import { requestPublicOrigin } from "@landscrape/auth";
import { clearSessionCookie, readSession, SESSION_COOKIE } from "@landscrape/session";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authEnabled } from "./app/lib/auth/constants";

function loginRedirect(request: NextRequest, pathname: string): NextResponse {
  const origin = requestPublicOrigin(request, {
    preferredEnv: "ADMIN_BASE_URL",
    devFallback: "http://localhost:3001"
  });
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("returnUrl", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
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
    return loginRedirect(request, pathname);
  }

  const session = await readSession(sessionId);
  if (!session) {
    const response = loginRedirect(request, pathname);
    clearSessionCookie(response.cookies);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
