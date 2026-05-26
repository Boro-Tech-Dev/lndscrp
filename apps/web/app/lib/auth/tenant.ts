import { canAccessTenant } from "@landscrape/auth";
import { DEFAULT_TENANT } from "../tenantConstants";
import { getAuthClaims, getSession } from "./session";
import { authEnabled } from "./constants";

export async function resolveTenantSlug(
  requestedSlug: string
): Promise<{ tenantSlug: string; forbidden: boolean }> {
  if (!authEnabled()) {
    return { tenantSlug: requestedSlug, forbidden: false };
  }

  const session = await getSession();
  if (!session) {
    return { tenantSlug: requestedSlug, forbidden: false };
  }

  if (canAccessTenant(session.claims, requestedSlug)) {
    return { tenantSlug: requestedSlug, forbidden: false };
  }

  const fallback =
    session.claims.tenants.find((slug) => slug.length > 0) ??
    (canAccessTenant(session.claims, DEFAULT_TENANT) ? DEFAULT_TENANT : session.claims.tenants[0] ?? DEFAULT_TENANT);

  return { tenantSlug: fallback, forbidden: true };
}

export async function filterTenantsForSession<T extends { tenant_slug: string }>(items: T[]): Promise<T[]> {
  if (!authEnabled()) return items;

  const claims = await getAuthClaims();
  if (!claims) return items;

  if (claims.roles.includes("admin") || claims.roles.includes("super_admin")) {
    return items;
  }

  const allowed = new Set(claims.tenants);
  return items.filter((item) => allowed.has(item.tenant_slug));
}

export async function getSessionEmail(): Promise<string | null> {
  const session = await getSession();
  return session?.email ?? null;
}
