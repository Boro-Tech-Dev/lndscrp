import type { LandscrapeAuthClaims } from "./types";

const TENANT_PREFIX = "tenant:";

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

function tenantSlugFromGroupName(name: string): string | null {
  if (name.startsWith(TENANT_PREFIX)) {
    return name.slice(TENANT_PREFIX.length);
  }
  if (name.startsWith("/")) {
    const trimmed = name.slice(1);
    if (trimmed.startsWith(TENANT_PREFIX)) {
      return trimmed.slice(TENANT_PREFIX.length);
    }
  }
  return null;
}

export function parseLandscrapeClaims(payload: Record<string, unknown>): LandscrapeAuthClaims {
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email =
    typeof payload.email === "string"
      ? payload.email
      : typeof payload.preferred_username === "string"
        ? payload.preferred_username
        : "";

  const realmAccess =
    payload.realm_access && typeof payload.realm_access === "object"
      ? (payload.realm_access as { roles?: unknown })
      : undefined;
  const roles = asStringArray(realmAccess?.roles);

  const groupNames = asStringArray(payload.groups);
  const tenants = groupNames
    .map(tenantSlugFromGroupName)
    .filter((slug): slug is string => slug !== null && slug.length > 0);

  return { sub, email, roles, tenants };
}

export function canAccessTenant(claims: LandscrapeAuthClaims, tenantSlug: string): boolean {
  if (claims.roles.includes("admin") || claims.roles.includes("super_admin")) {
    return true;
  }
  return claims.tenants.includes(tenantSlug);
}

export function hasAdminRole(claims: LandscrapeAuthClaims): boolean {
  return claims.roles.includes("admin") || claims.roles.includes("super_admin");
}
