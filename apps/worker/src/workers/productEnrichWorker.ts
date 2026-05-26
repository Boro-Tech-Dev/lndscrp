import { query } from "@landscrape/db";
import { enrichProduct } from "@landscrape/product-enrichment";
import { createWorkerForQueue } from "@landscrape/jobs";
import type { EnrichProductPayload } from "@landscrape/jobs";
import { getConfig } from "@landscrape/config";

interface ProductRow {
  product_id: string;
  tenant_id: string;
  brand_name: string;
  generic_name: string;
  lifecycle_stage: "pipeline" | "approved" | "generic";
  enrich_intervention: string | null;
  enrich_brand_search: string | null;
}

async function loadProduct(productId: string, tenantId: string): Promise<ProductRow | null> {
  const rows = await query<ProductRow>(
    `SELECT product_id, tenant_id, brand_name, generic_name, lifecycle_stage,
            enrich_intervention, enrich_brand_search
     FROM workspace_products
     WHERE product_id = $1 AND tenant_id = $2`,
    [productId, tenantId]
  );
  return rows[0] ?? null;
}

async function upsertEnrichment(
  productId: string,
  result: Awaited<ReturnType<typeof enrichProduct>>
): Promise<void> {
  await query(
    `INSERT INTO workspace_product_enrichment (
       product_id, trial_summary, regulatory_summary, label_updates,
       enriched_pdufa_date, enriched_approval_date, last_enriched_at, enrichment_errors, updated_at
     ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::date, $6::date, NOW(), $7::jsonb, NOW())
     ON CONFLICT (product_id) DO UPDATE SET
       trial_summary = EXCLUDED.trial_summary,
       regulatory_summary = EXCLUDED.regulatory_summary,
       label_updates = EXCLUDED.label_updates,
       enriched_pdufa_date = EXCLUDED.enriched_pdufa_date,
       enriched_approval_date = EXCLUDED.enriched_approval_date,
       last_enriched_at = NOW(),
       enrichment_errors = EXCLUDED.enrichment_errors,
       updated_at = NOW()`,
    [
      productId,
      JSON.stringify(result.trialSummary),
      JSON.stringify(result.regulatorySummary),
      JSON.stringify(result.labelUpdates),
      result.enrichedPdufaDate,
      result.enrichedApprovalDate,
      JSON.stringify(result.enrichmentErrors),
    ]
  );
}

export function startProductEnrichWorker(): void {
  const { enrichConcurrency } = getConfig();
  createWorkerForQueue(
    "enrich:product",
    async (data) => {
      const payload = data as EnrichProductPayload;
      const row = await loadProduct(payload.productId, payload.tenantId);
      if (!row) {
        console.warn(`[enrich:product] product ${payload.productId} not found`);
        return;
      }
      try {
        const result = await enrichProduct({
          genericName: row.generic_name,
          brandName: row.brand_name,
          lifecycleStage: row.lifecycle_stage,
          enrichIntervention: row.enrich_intervention ?? undefined,
          enrichBrandSearch: row.enrich_brand_search ?? undefined,
        });
        await upsertEnrichment(row.product_id, result);
        console.log(
          `[enrich:product] ${row.brand_name} enriched (${result.enrichmentErrors.length} partial errors)`
        );
      } catch (err) {
        console.error(`[enrich:product] ${row.brand_name} failed`, err);
        await query(
          `INSERT INTO workspace_product_enrichment (product_id, enrichment_errors, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (product_id) DO UPDATE SET
             enrichment_errors = EXCLUDED.enrichment_errors,
             updated_at = NOW()`,
          [row.product_id, JSON.stringify([String(err)])]
        );
      }
    },
    enrichConcurrency
  );
}
