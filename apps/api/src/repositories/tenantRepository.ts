import { one, query } from "@landscrape/db";

export interface TenantRow {
  tenant_id: string;
  tenant_slug: string;
  display_name: string;
  brand_color: string;
  industry_pack: string;
}

export async function findTenantBySlug(tenantSlug: string): Promise<TenantRow | null> {
  return one<TenantRow>(
    `
    SELECT tenant_id, tenant_slug, display_name, brand_color, industry_pack
    FROM tenants
    WHERE tenant_slug = $1
    `,
    [tenantSlug]
  );
}

export async function listTenants(): Promise<
  Pick<TenantRow, "tenant_id" | "tenant_slug" | "display_name" | "brand_color">[]
> {
  return query<Pick<TenantRow, "tenant_id" | "tenant_slug" | "display_name" | "brand_color">>(
    `
    SELECT tenant_id, tenant_slug, display_name, brand_color
    FROM tenants
    ORDER BY display_name ASC
    `
  );
}
