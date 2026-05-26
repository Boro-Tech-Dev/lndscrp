export const SESSION_COOKIE = "landscrape_session";

/** Legacy JWT cookies from the old auth stack — cleared on login/logout. */
export const LEGACY_AUTH_COOKIES = [
  "landscrape_access",
  "landscrape_refresh",
  "landscrape_email"
] as const;

export function sessionCookieDomain(): string | undefined {
  const raw = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return raw || undefined;
}

export function sessionCookieSecure(): boolean {
  const raw = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function defaultSessionMaxAgeSeconds(): number {
  const raw = process.env.SESSION_TTL_SECONDS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 259200;
}

export function sessionCookieOptions(maxAgeSeconds: number = defaultSessionMaxAgeSeconds()) {
  const domain = sessionCookieDomain();
  return {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
    ...(domain ? { domain } : {})
  };
}

export function sessionCookieDeleteOptions() {
  const domain = sessionCookieDomain();
  return {
    path: "/",
    ...(domain ? { domain } : {})
  };
}

export type ResponseCookies = {
  set(name: string, value: string, options: ReturnType<typeof sessionCookieOptions>): void;
  delete(options: { name: string; path: string; domain?: string }): void;
};

export function setSessionCookie(cookies: ResponseCookies, sessionId: string, maxAgeSeconds?: number): void {
  cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions(maxAgeSeconds));
}

export function clearSessionCookie(cookies: ResponseCookies): void {
  const opts = sessionCookieDeleteOptions();
  cookies.delete({ name: SESSION_COOKIE, ...opts });
  cookies.delete({ name: SESSION_COOKIE, path: "/" });
}

export type RequestCookies = {
  get(name: string): { value?: string } | undefined;
  delete(options: { name: string; path: string; domain?: string }): void;
};

/** Remove session cookie from a Next.js request cookie store (Server Components). */
export function deleteSessionCookieFromStore(cookies: RequestCookies): void {
  const opts = sessionCookieDeleteOptions();
  cookies.delete({ name: SESSION_COOKIE, ...opts });
  cookies.delete({ name: SESSION_COOKIE, path: "/" });
}

export function clearLegacyAuthCookies(cookies: ResponseCookies): void {
  const opts = sessionCookieDeleteOptions();
  for (const name of LEGACY_AUTH_COOKIES) {
    cookies.delete({ name, ...opts });
    cookies.delete({ name, path: "/" });
  }
}
