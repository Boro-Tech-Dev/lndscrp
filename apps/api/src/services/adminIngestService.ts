import { query } from "@landscrape/db";
import { createQueue, interactiveJobOptions } from "@landscrape/jobs";
import type { IngestSourcePayload } from "@landscrape/jobs";

interface BootstrapSourceRow {
  source_id: string;
  tenant_id: string;
  tenant_slug: string;
  source_config: Record<string, unknown> | null;
}

export async function bootstrapTenantIngest(tenantId: string, tenantSlug: string): Promise<number> {
  const sources = await query<BootstrapSourceRow>(
    `SELECT s.source_id, s.tenant_id, t.tenant_slug, s.source_config
     FROM sources s
     JOIN tenants t ON t.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1 AND s.is_active = TRUE`,
    [tenantId]
  );

  const ingestQ = createQueue("ingest:source");
  let enqueued = 0;

  for (const row of sources) {
    const cfg = row.source_config ?? {};
    if (cfg.authMode === "portal") continue;

    const payload: IngestSourcePayload = {
      tenantId: row.tenant_id,
      sourceId: row.source_id,
      tenantSlug: row.tenant_slug ?? tenantSlug,
    };
    await ingestQ.add("ingest:source", payload, {
      ...interactiveJobOptions(),
      jobId: `bootstrap-${row.source_id}`,
    });
    enqueued += 1;
  }

  return enqueued;
}
