export type RequestPublicOriginOptions = {
  /** Env var name to read first (e.g. WEB_PUBLIC_URL or ADMIN_BASE_URL). */
  preferredEnv?: string;
  /** Dev fallback when no public origin can be resolved. */
  devFallback?: string;
};

const DOCKER_SHORT_ID = /^[a-f0-9]{12}$/i;

/** True when host is safe to use in browser redirects (not a Docker container short id). */
export function isPublicHostname(host: string): boolean {
  const hostname = host.split(":")[0]?.trim() ?? "";
  if (!hostname) return false;
  if (DOCKER_SHORT_ID.test(hostname)) return false;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  return hostname.includes(".");
}

function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function originFromForwardedHeaders(request: Request): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (!forwardedHost || !isPublicHostname(forwardedHost)) return null;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return `${proto}://${forwardedHost}`;
}

function originFromRequestUrl(request: Request): string | null {
  try {
    const url = new URL(request.url);
    if (isPublicHostname(url.host)) {
      return url.origin;
    }
  } catch {
    // ignore invalid request.url
  }
  return null;
}

/**
 * Origin for auth redirects behind reverse proxies (Traefik, Docker).
 * Prefers explicit env, then forwarded headers, then request.url if public.
 */
export function requestPublicOrigin(
  request: Request,
  options?: RequestPublicOriginOptions
): string {
  const preferred = options?.preferredEnv?.trim();
  if (preferred) {
    const fromPreferred = process.env[preferred]?.trim();
    if (fromPreferred) return normalizeOrigin(fromPreferred);
  }

  const fromForwarded = originFromForwardedHeaders(request);
  if (fromForwarded) return fromForwarded;

  const fromUrl = originFromRequestUrl(request);
  if (fromUrl) return fromUrl;

  const devFallback = options?.devFallback?.trim();
  if (devFallback) return normalizeOrigin(devFallback);

  return "http://localhost:3000";
}
