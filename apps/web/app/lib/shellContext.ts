import { redirect } from "next/navigation";
import { listTenants } from "./api";
import { authEnabled } from "./auth/constants";
import { requireSession } from "./auth/session";
import { filterTenantsForSession, getSessionEmail, resolveTenantSlug } from "./auth/tenant";
import { tenantFromParams, withTenant } from "./navigation";

export const dynamic = "force-dynamic";

export async function tenantSlugFromSearchParams(
  sp: Record<string, string | string[] | undefined> | null | undefined,
  path: string
): Promise<string> {
  const requested = tenantFromParams(sp);
  const { tenantSlug, forbidden } = await resolveTenantSlug(requested);
  if (forbidden) {
    redirect(withTenant(path, tenantSlug));
  }
  return tenantSlug;
}

export async function getShellContext(
  sp: Record<string, string | string[] | undefined> | null | undefined,
  path: string
) {
  if (authEnabled()) {
    await requireSession();
  }

  const tenantSlug = await tenantSlugFromSearchParams(sp, path);
  const [tenantsList, userEmail] = await Promise.all([listTenants(), getSessionEmail()]);
  const tenants = await filterTenantsForSession(tenantsList.items);
  return { tenantSlug, userEmail, tenants };
}
