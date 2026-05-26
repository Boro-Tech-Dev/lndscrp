function hostnameFromEnvUrl(envValue: string | undefined): string | null {
  const trimmed = envValue?.trim();
  if (!trimmed) return null;
  try {
    const url = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function allowedReturnHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const key of ["WEB_PUBLIC_URL", "ADMIN_BASE_URL"] as const) {
    const host = hostnameFromEnvUrl(process.env[key]);
    if (!host) continue;
    hosts.add(host);
    if (host.startsWith("www.")) {
      hosts.add(host.slice(4));
    } else {
      hosts.add(`www.${host}`);
    }
  }
  return hosts;
}

/**
 * Sanitize post-login redirect targets: relative paths or absolute URLs on allowed public hosts.
 */
export function safeReturnUrl(value: string | null | undefined, fallback = "/"): string {
  const raw = value?.trim() || fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    if (!allowedReturnHosts().has(parsed.hostname.toLowerCase())) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return fallback;
  }
}

export type WebLoginUrlOptions = {
  returnUrl?: string;
  error?: string;
};

/** Absolute URL for the web app sign-in page (WEB_PUBLIC_URL). */
export function webLoginUrl(options?: WebLoginUrlOptions): string {
  const raw = process.env.WEB_PUBLIC_URL?.trim() || "http://localhost:3000";
  const origin =
    raw.startsWith("http://") || raw.startsWith("https://")
      ? raw.replace(/\/$/, "")
      : `https://${raw.replace(/\/$/, "")}`;
  const url = new URL("/login", origin);
  if (options?.returnUrl) {
    url.searchParams.set("returnUrl", safeReturnUrl(options.returnUrl));
  }
  if (options?.error) {
    url.searchParams.set("error", options.error);
  }
  return url.toString();
}
