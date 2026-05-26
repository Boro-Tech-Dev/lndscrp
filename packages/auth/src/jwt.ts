/** Decode JWT `exp` (seconds since epoch) without verifying the signature. */
export function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** True when the token is expired or within skewSeconds of expiry. */
export function isJwtExpired(exp: number, skewSeconds = 30): boolean {
  return Date.now() >= (exp - skewSeconds) * 1000;
}
