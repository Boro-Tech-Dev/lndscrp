import {
  keycloakConfigFromEnv,
  requestPublicOrigin,
  revokeKeycloakRefreshToken
} from "@landscrape/auth";
import {
  clearLegacyAuthCookies,
  clearSessionCookie,
  destroySession,
  readSession,
  SESSION_COOKIE
} from "@landscrape/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value?.trim();

  if (sessionId) {
    const session = await readSession(sessionId);
    const config = keycloakConfigFromEnv();
    if (session?.refreshToken && config) {
      try {
        await revokeKeycloakRefreshToken(config, session.refreshToken);
      } catch {
        // Best-effort revoke.
      }
    }
    await destroySession(sessionId);
  }

  const origin = requestPublicOrigin(request, {
    preferredEnv: "WEB_PUBLIC_URL",
    devFallback: "http://localhost:3000"
  });
  const response = NextResponse.redirect(new URL("/login", origin), 303);
  clearLegacyAuthCookies(response.cookies);
  clearSessionCookie(response.cookies);
  return response;
}
