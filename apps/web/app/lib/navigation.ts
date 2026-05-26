import { DEFAULT_TENANT } from "./tenantConstants";

export function withTenant(path: string, tenantSlug: string, extra?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (tenantSlug !== DEFAULT_TENANT) {
    params.set("tenant", tenantSlug);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== "") {
        params.set(k, v);
      }
    }
  }
  const qs = params.toString();
  if (!qs) {
    return path;
  }
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${qs}`;
}

export function tenantFromParams(
  sp: Record<string, string | string[] | undefined> | null | undefined
): string {
  const raw = sp?.tenant;
  const t = Array.isArray(raw) ? raw[0] : raw;
  return t && t.length > 0 ? t : DEFAULT_TENANT;
}

export { DEFAULT_TENANT };
