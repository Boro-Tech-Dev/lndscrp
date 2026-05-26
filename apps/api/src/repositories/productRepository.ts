import { query, one } from "@landscrape/db";

export interface ProductRow {
  product_id: string;
  tenant_id: string;
  brand_name: string;
  generic_name: string;
  company: string | null;
  role: "owned" | "competitor";
  therapeutic_class: string | null;
  indications: string[];
  lifecycle_stage: "pipeline" | "approved" | "generic";
  sort_order: number;
  hcp_url: string | null;
  dtc_url: string | null;
  label_url: string | null;
  curated_pdufa_date: string | null;
  curated_approval_date: string | null;
  curated_loe_date: string | null;
  enrich_intervention: string | null;
  enrich_brand_search: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductEnrichmentRow {
  trial_summary: Record<string, unknown>;
  regulatory_summary: Record<string, unknown>;
  label_updates: Array<{ date: string; title: string; url: string; source: string }>;
  enriched_pdufa_date: string | null;
  enriched_approval_date: string | null;
  last_enriched_at: string | null;
  enrichment_errors: string[];
}

export interface ProductTileRow extends ProductRow {
  trial_summary: Record<string, unknown>;
  regulatory_summary: Record<string, unknown>;
  label_updates: Array<{ date: string; title: string; url: string; source: string }>;
  enriched_pdufa_date: string | null;
  enriched_approval_date: string | null;
  last_enriched_at: string | null;
  enrichment_errors: string[];
  hcp_source_count: number;
  dtc_source_count: number;
}

export interface CreateProductInput {
  brand_name: string;
  generic_name: string;
  company?: string | null;
  role?: "owned" | "competitor";
  therapeutic_class?: string | null;
  indications?: string[];
  lifecycle_stage?: "pipeline" | "approved" | "generic";
  sort_order?: number;
  hcp_url?: string | null;
  dtc_url?: string | null;
  label_url?: string | null;
  curated_pdufa_date?: string | null;
  curated_approval_date?: string | null;
  curated_loe_date?: string | null;
  enrich_intervention?: string | null;
  enrich_brand_search?: string | null;
}

export type PatchProductInput = Partial<CreateProductInput>;

function mapProductRow(row: Record<string, unknown>): ProductRow {
  return {
    product_id: String(row.product_id),
    tenant_id: String(row.tenant_id),
    brand_name: String(row.brand_name),
    generic_name: String(row.generic_name),
    company: row.company != null ? String(row.company) : null,
    role: row.role as ProductRow["role"],
    therapeutic_class: row.therapeutic_class != null ? String(row.therapeutic_class) : null,
    indications: Array.isArray(row.indications) ? row.indications.map(String) : [],
    lifecycle_stage: row.lifecycle_stage as ProductRow["lifecycle_stage"],
    sort_order: Number(row.sort_order ?? 0),
    hcp_url: row.hcp_url != null ? String(row.hcp_url) : null,
    dtc_url: row.dtc_url != null ? String(row.dtc_url) : null,
    label_url: row.label_url != null ? String(row.label_url) : null,
    curated_pdufa_date: row.curated_pdufa_date != null ? String(row.curated_pdufa_date).slice(0, 10) : null,
    curated_approval_date: row.curated_approval_date != null ? String(row.curated_approval_date).slice(0, 10) : null,
    curated_loe_date: row.curated_loe_date != null ? String(row.curated_loe_date).slice(0, 10) : null,
    enrich_intervention: row.enrich_intervention != null ? String(row.enrich_intervention) : null,
    enrich_brand_search: row.enrich_brand_search != null ? String(row.enrich_brand_search) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listProductsWithEnrichment(tenantId: string): Promise<ProductTileRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      p.*,
      COALESCE(e.trial_summary, '{}'::jsonb) AS trial_summary,
      COALESCE(e.regulatory_summary, '{}'::jsonb) AS regulatory_summary,
      COALESCE(e.label_updates, '[]'::jsonb) AS label_updates,
      e.enriched_pdufa_date,
      e.enriched_approval_date,
      e.last_enriched_at,
      COALESCE(e.enrichment_errors, '[]'::jsonb) AS enrichment_errors,
      (
        SELECT COUNT(*)::int FROM sources s
        WHERE s.tenant_id = p.tenant_id
          AND s.is_active = TRUE
          AND s.source_config->>'competitorBrand' = p.brand_name
          AND s.source_config->>'channel' = 'hcp'
      ) AS hcp_source_count,
      (
        SELECT COUNT(*)::int FROM sources s
        WHERE s.tenant_id = p.tenant_id
          AND s.is_active = TRUE
          AND s.source_config->>'competitorBrand' = p.brand_name
          AND s.source_config->>'channel' = 'dtc'
      ) AS dtc_source_count
    FROM workspace_products p
    LEFT JOIN workspace_product_enrichment e ON e.product_id = p.product_id
    WHERE p.tenant_id = $1
    ORDER BY p.sort_order ASC, p.brand_name ASC
    `,
    [tenantId]
  );

  return rows.map((row) => {
    const base = mapProductRow(row);
    const labelUpdates = Array.isArray(row.label_updates)
      ? (row.label_updates as Array<{ date: string; title: string; url: string; source: string }>)
      : [];
    const enrichmentErrors = Array.isArray(row.enrichment_errors)
      ? row.enrichment_errors.map(String)
      : [];
    return {
      ...base,
      trial_summary: (row.trial_summary as Record<string, unknown>) ?? {},
      regulatory_summary: (row.regulatory_summary as Record<string, unknown>) ?? {},
      label_updates: labelUpdates,
      enriched_pdufa_date:
        row.enriched_pdufa_date != null ? String(row.enriched_pdufa_date).slice(0, 10) : null,
      enriched_approval_date:
        row.enriched_approval_date != null ? String(row.enriched_approval_date).slice(0, 10) : null,
      last_enriched_at: row.last_enriched_at != null ? String(row.last_enriched_at) : null,
      enrichment_errors: enrichmentErrors,
      hcp_source_count: Number(row.hcp_source_count ?? 0),
      dtc_source_count: Number(row.dtc_source_count ?? 0),
    };
  });
}

export async function countCompetitorProducts(tenantId: string): Promise<number> {
  const row = await one<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM workspace_products WHERE tenant_id = $1 AND role = 'competitor'`,
    [tenantId]
  );
  return Number(row?.count ?? 0);
}

export async function getProductById(tenantId: string, productId: string): Promise<ProductRow | null> {
  const row = await one<Record<string, unknown>>(
    `SELECT * FROM workspace_products WHERE tenant_id = $1 AND product_id = $2`,
    [tenantId, productId]
  );
  return row ? mapProductRow(row) : null;
}

export async function insertProduct(tenantId: string, input: CreateProductInput): Promise<ProductRow> {
  const rows = await query<Record<string, unknown>>(
    `
    INSERT INTO workspace_products (
      tenant_id, brand_name, generic_name, company, role, therapeutic_class, indications,
      lifecycle_stage, sort_order, hcp_url, dtc_url, label_url,
      curated_pdufa_date, curated_approval_date, curated_loe_date,
      enrich_intervention, enrich_brand_search
    ) VALUES (
      $1, $2, $3, $4, $5::product_role, $6, $7, $8::lifecycle_stage, $9, $10, $11, $12,
      $13::date, $14::date, $15::date, $16, $17
    )
    RETURNING *
    `,
    [
      tenantId,
      input.brand_name,
      input.generic_name,
      input.company ?? null,
      input.role ?? "competitor",
      input.therapeutic_class ?? null,
      input.indications ?? [],
      input.lifecycle_stage ?? "approved",
      input.sort_order ?? 99,
      input.hcp_url ?? null,
      input.dtc_url ?? null,
      input.label_url ?? null,
      input.curated_pdufa_date ?? null,
      input.curated_approval_date ?? null,
      input.curated_loe_date ?? null,
      input.enrich_intervention ?? input.generic_name,
      input.enrich_brand_search ?? input.brand_name,
    ]
  );
  return mapProductRow(rows[0]!);
}

export async function patchProduct(
  tenantId: string,
  productId: string,
  input: PatchProductInput
): Promise<ProductRow | null> {
  const existing = await getProductById(tenantId, productId);
  if (!existing) return null;

  const merged: CreateProductInput = {
    brand_name: input.brand_name ?? existing.brand_name,
    generic_name: input.generic_name ?? existing.generic_name,
    company: input.company !== undefined ? input.company : existing.company,
    role: input.role ?? existing.role,
    therapeutic_class:
      input.therapeutic_class !== undefined ? input.therapeutic_class : existing.therapeutic_class,
    indications: input.indications ?? existing.indications,
    lifecycle_stage: input.lifecycle_stage ?? existing.lifecycle_stage,
    sort_order: input.sort_order ?? existing.sort_order,
    hcp_url: input.hcp_url !== undefined ? input.hcp_url : existing.hcp_url,
    dtc_url: input.dtc_url !== undefined ? input.dtc_url : existing.dtc_url,
    label_url: input.label_url !== undefined ? input.label_url : existing.label_url,
    curated_pdufa_date:
      input.curated_pdufa_date !== undefined ? input.curated_pdufa_date : existing.curated_pdufa_date,
    curated_approval_date:
      input.curated_approval_date !== undefined ? input.curated_approval_date : existing.curated_approval_date,
    curated_loe_date:
      input.curated_loe_date !== undefined ? input.curated_loe_date : existing.curated_loe_date,
    enrich_intervention:
      input.enrich_intervention !== undefined ? input.enrich_intervention : existing.enrich_intervention,
    enrich_brand_search:
      input.enrich_brand_search !== undefined ? input.enrich_brand_search : existing.enrich_brand_search,
  };

  const rows = await query<Record<string, unknown>>(
    `
    UPDATE workspace_products SET
      brand_name = $3,
      generic_name = $4,
      company = $5,
      role = $6::product_role,
      therapeutic_class = $7,
      indications = $8,
      lifecycle_stage = $9::lifecycle_stage,
      sort_order = $10,
      hcp_url = $11,
      dtc_url = $12,
      label_url = $13,
      curated_pdufa_date = $14::date,
      curated_approval_date = $15::date,
      curated_loe_date = $16::date,
      enrich_intervention = $17,
      enrich_brand_search = $18,
      updated_at = NOW()
    WHERE tenant_id = $1 AND product_id = $2
    RETURNING *
    `,
    [
      tenantId,
      productId,
      merged.brand_name,
      merged.generic_name,
      merged.company ?? null,
      merged.role ?? "competitor",
      merged.therapeutic_class ?? null,
      merged.indications ?? [],
      merged.lifecycle_stage ?? "approved",
      merged.sort_order ?? 0,
      merged.hcp_url ?? null,
      merged.dtc_url ?? null,
      merged.label_url ?? null,
      merged.curated_pdufa_date ?? null,
      merged.curated_approval_date ?? null,
      merged.curated_loe_date ?? null,
      merged.enrich_intervention ?? merged.generic_name,
      merged.enrich_brand_search ?? merged.brand_name,
    ]
  );
  return rows[0] ? mapProductRow(rows[0]) : null;
}

export async function deleteProduct(tenantId: string, productId: string): Promise<boolean> {
  const rows = await query<{ product_id: string }>(
    `DELETE FROM workspace_products WHERE tenant_id = $1 AND product_id = $2 RETURNING product_id`,
    [tenantId, productId]
  );
  return rows.length > 0;
}
