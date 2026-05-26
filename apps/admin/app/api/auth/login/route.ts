import {
  fetchKeycloakTokenPassword,
  keycloakConfigFromEnv,
  parseLandscrapeClaims,
  requestPublicOrigin
} from "@landscrape/auth";
import {
  clearLegacyAuthCookies,
  clearSessionCookie,
  createSession,
  setSessionCookie
} from "@landscrape/session";
import { NextResponse } from "next/server";

function safeReturnUrl(value: string | null | undefined): string {
  const raw = value?.trim() || "/";
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/";
}

async function readCredentials(request: Request): Promise<{
  email: string;
  password: string;
  returnUrl: string;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    return {
      email: typeof form.get("email") === "string" ? String(form.get("email")).trim() : "",
      password: typeof form.get("password") === "string" ? String(form.get("password")) : "",
      returnUrl: safeReturnUrl(
        typeof form.get("returnUrl") === "string" ? String(form.get("returnUrl")) : null
      )
    };
  }

  let body: { email?: string; password?: string; returnUrl?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string; returnUrl?: string };
  } catch {
    return { email: "", password: "", returnUrl: "/" };
  }
  return {
    email: typeof body.email === "string" ? body.email.trim() : "",
    password: typeof body.password === "string" ? body.password : "",
    returnUrl: safeReturnUrl(body.returnUrl)
  };
}

function loginErrorRedirect(request: Request, returnUrl: string): NextResponse {
  const origin = requestPublicOrigin(request, {
    preferredEnv: "ADMIN_BASE_URL",
    devFallback: "http://localhost:3001"
  });
  const url = new URL("/login", origin);
  url.searchParams.set("error", "invalid");
  url.searchParams.set("returnUrl", returnUrl);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const { email, password, returnUrl } = await readCredentials(request);
  if (!email || !password || !email.includes("@")) {
    return loginErrorRedirect(request, returnUrl);
  }

  const config = keycloakConfigFromEnv();
  if (!config) {
    return NextResponse.json({ error: "Auth is not configured" }, { status: 503 });
  }

  try {
    const tokens = await fetchKeycloakTokenPassword(config, email, password);
    if (!tokens.refresh_token?.trim()) {
      return NextResponse.json({ error: "Auth server did not issue a refresh token" }, { status: 503 });
    }
    const payload = JSON.parse(
      Buffer.from(tokens.access_token.split(".")[1], "base64url").toString("utf8")
    ) as Record<string, unknown>;
    const claims = parseLandscrapeClaims(payload);
    const sessionId = await createSession(tokens, claims.email || email);

    const origin = requestPublicOrigin(request, {
      preferredEnv: "ADMIN_BASE_URL",
      devFallback: "http://localhost:3001"
    });
    const target = new URL(returnUrl, origin);
    const response = NextResponse.redirect(target, 303);
    clearLegacyAuthCookies(response.cookies);
    clearSessionCookie(response.cookies);
    setSessionCookie(response.cookies, sessionId);
    return response;
  } catch {
    return loginErrorRedirect(request, returnUrl);
  }
}
