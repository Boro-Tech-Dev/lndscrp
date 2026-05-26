import type { ProductTileRow } from "../repositories/productRepository";

export interface ProductTileDto {
  productId: string;
  brandName: string;
  genericName: string;
  company: string | null;
  role: "owned" | "competitor";
  therapeuticClass: string | null;
  indications: string[];
  lifecycleStage: "pipeline" | "approved" | "generic";
  sortOrder: number;
  hcpUrl: string | null;
  dtcUrl: string | null;
  labelUrl: string | null;
  pdufaDate: string | null;
  pdufaIsEstimated: boolean;
  approvalDate: string | null;
  loeDate: string | null;
  labelUpdates: Array<{ date: string; title: string; url: string; source: string }>;
  trialNctId: string | null;
  trialStatus: string | null;
  trialPhases: string[];
  lastEnrichedAt: string | null;
  enrichmentErrors: string[];
  hcpSourceCount: number;
  dtcSourceCount: number;
}

function coalesceDate(curated: string | null, enriched: string | null): string | null {
  if (curated) return curated;
  return enriched;
}

export function mapProductToTile(row: ProductTileRow): ProductTileDto {
  const trial = row.trial_summary ?? {};
  const pdufaCurated = row.curated_pdufa_date;
  const pdufaEnriched = row.enriched_pdufa_date;
  const pdufaDate = coalesceDate(pdufaCurated, pdufaEnriched);
  const pdufaIsEstimated =
    !pdufaCurated && Boolean(trial.timelineIsEstimated) && pdufaEnriched === trial.inferredTimelineDate;

  return {
    productId: row.product_id,
    brandName: row.brand_name,
    genericName: row.generic_name,
    company: row.company,
    role: row.role,
    therapeuticClass: row.therapeutic_class,
    indications: row.indications,
    lifecycleStage: row.lifecycle_stage,
    sortOrder: row.sort_order,
    hcpUrl: row.hcp_url,
    dtcUrl: row.dtc_url,
    labelUrl: row.label_url,
    pdufaDate,
    pdufaIsEstimated,
    approvalDate: coalesceDate(row.curated_approval_date, row.enriched_approval_date),
    loeDate: row.curated_loe_date,
    labelUpdates: row.label_updates.slice(0, 5),
    trialNctId: typeof trial.nctId === "string" ? trial.nctId : null,
    trialStatus: typeof trial.overallStatus === "string" ? trial.overallStatus : null,
    trialPhases: Array.isArray(trial.phases) ? trial.phases.map(String) : [],
    lastEnrichedAt: row.last_enriched_at,
    enrichmentErrors: row.enrichment_errors,
    hcpSourceCount: row.hcp_source_count,
    dtcSourceCount: row.dtc_source_count,
  };
}
