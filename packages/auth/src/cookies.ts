export function authCookieDomain(): string | undefined {
  const raw = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return raw || undefined;
}

export function authCookieSecure(): boolean {
  const raw = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function authCookieOptions(maxAgeSeconds: number) {
  const domain = authCookieDomain();
  return {
    httpOnly: true,
    secure: authCookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
    ...(domain ? { domain } : {})
  };
}

export function authCookieDeleteOptions() {
  const domain = authCookieDomain();
  return {
    path: "/",
    ...(domain ? { domain } : {})
  };
}
