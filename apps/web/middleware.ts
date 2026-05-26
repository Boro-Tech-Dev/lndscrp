import { hasAdminRole, requestPublicOrigin, webLoginUrl } from "@landscrape/auth";
import { clearSessionCookie, readSession, SESSION_COOKIE } from "@landscrape/session";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authEnabled } from "./app/lib/auth/constants";

function loginRedirect(request: NextRequest, pathname: string): NextResponse {
  const returnPath = `${pathname}${request.nextUrl.search}`;
  const loginUrl = new URL(webLoginUrl({ returnUrl: returnPath }));
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/login")) {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value?.trim();
    if (sessionId) {
      const session = await readSession(sessionId);
      if (!session) {
        const response = NextResponse.next();
        clearSessionCookie(response.cookies);
        return response;
      }
    }
    return NextResponse.next();
  }

  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminPath && !isAdminApi) {
    if (pathname.startsWith("/api/")) {
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

  if (pathname === "/admin/forbidden") {
    return NextResponse.next();
  }

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value?.trim();
  if (!sessionId) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return loginRedirect(request, pathname);
  }

  const session = await readSession(sessionId);
  if (!session) {
    if (isAdminApi) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      clearSessionCookie(response.cookies);
      return response;
    }
    const response = loginRedirect(request, pathname);
    clearSessionCookie(response.cookies);
    return response;
  }

  if (!hasAdminRole(session.claims)) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }
    const origin = requestPublicOrigin(request, {
      preferredEnv: "WEB_PUBLIC_URL",
      devFallback: "http://localhost:3000"
    });
    return NextResponse.redirect(new URL("/admin/forbidden", origin));
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
