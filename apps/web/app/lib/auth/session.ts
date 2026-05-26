import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessTenant, hasAdminRole, type LandscrapeAuthClaims, webLoginUrl } from "@landscrape/auth";
import { loadSession, SESSION_COOKIE, type SessionData } from "@landscrape/session";
import { authEnabled } from "./constants";

export type AuthSession = SessionData;

async function getSessionUncached(): Promise<SessionData | null> {
  if (!authEnabled()) return null;
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value?.trim();
  if (!id) return null;
  return loadSession(id);
}

export const getSession = cache(getSessionUncached);

export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    redirect(webLoginUrl());
  }
  return session;
}

export async function requireAdminSession(): Promise<SessionData> {
  const session = await requireSession();
  if (!hasAdminRole(session.claims)) {
    redirect("/admin/forbidden");
  }
  return session;
}

export async function getServerAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.accessToken ?? null;
}

export async function getAuthClaims(): Promise<LandscrapeAuthClaims | null> {
  const session = await getSession();
  return session?.claims ?? null;
}

export async function assertTenantAccess(tenantSlug: string): Promise<LandscrapeAuthClaims> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!canAccessTenant(session.claims, tenantSlug)) {
    throw new Error("Forbidden");
  }
  return session.claims;
}
