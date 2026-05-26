import { query } from "@landscrape/db";
import { backgroundJobOptions, createQueue } from "@landscrape/jobs";
import type { EnrichProductPayload } from "@landscrape/jobs";

const ENRICH_STALE_MS = 24 * 60 * 60 * 1000;

export async function enqueueDueProductEnrichments(): Promise<number> {
  const now = Date.now();
  const rows = await query<{ product_id: string; tenant_id: string; last_enriched_at: string | null }>(
    `SELECT p.product_id, p.tenant_id, e.last_enriched_at
     FROM workspace_products p
     LEFT JOIN workspace_product_enrichment e ON e.product_id = p.product_id`
  );

  const q = createQueue("enrich:product");
  let enqueued = 0;

  for (const row of rows) {
    const last = row.last_enriched_at ? new Date(row.last_enriched_at).getTime() : 0;
    const due = !last || now - last >= ENRICH_STALE_MS;
    if (!due) continue;

    const payload: EnrichProductPayload = {
      tenantId: row.tenant_id,
      productId: row.product_id,
    };
    await q.add("enrich:product", payload, {
      ...backgroundJobOptions(),
      jobId: `enrich-product-${row.product_id}-${Math.floor(now / ENRICH_STALE_MS)}`,
    });
    enqueued += 1;
  }

  return enqueued;
}

export async function enqueueProductEnrichment(tenantId: string, productId: string): Promise<void> {
  const q = createQueue("enrich:product");
  const payload: EnrichProductPayload = { tenantId, productId };
  await q.add("enrich:product", payload, {
    ...backgroundJobOptions(),
    jobId: `enrich-product-${productId}-manual-${Date.now()}`,
  });
}

export async function enqueueAllProductsForTenant(tenantId: string): Promise<number> {
  const rows = await query<{ product_id: string }>(
    `SELECT product_id FROM workspace_products WHERE tenant_id = $1`,
    [tenantId]
  );
  for (const row of rows) {
    await enqueueProductEnrichment(tenantId, row.product_id);
  }
  return rows.length;
}
