import { backgroundJobOptions, createQueue } from "@landscrape/jobs";
import type { EnrichProductPayload } from "@landscrape/jobs";
import { query } from "@landscrape/db";

export async function enqueueProductEnrichment(tenantId: string, productId: string): Promise<void> {
  const q = createQueue("enrich:product");
  const payload: EnrichProductPayload = { tenantId, productId };
  await q.add("enrich:product", payload, {
    ...backgroundJobOptions(),
    jobId: `enrich-product-${productId}-api-${Date.now()}`,
  });
}

export async function bootstrapTenantProductEnrich(tenantId: string): Promise<number> {
  const rows = await query<{ product_id: string }>(
    `SELECT product_id FROM workspace_products WHERE tenant_id = $1`,
    [tenantId]
  );
  for (const row of rows) {
    await enqueueProductEnrichment(tenantId, row.product_id);
  }
  return rows.length;
}
