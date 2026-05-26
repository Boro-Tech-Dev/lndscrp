import { query, one } from "@landscrape/db";
import type { Signal, SignalType } from "@landscrape/types";

interface DbSignalRow {
  signal_id: string;
  tenant_id: string;
  source_id: string | null;
  signal_type: Signal["signalType"];
  title: string;
  summary: string;
  full_text: string | null;
  competitor_brand: string | null;
  disease_state: string | null;
  market_region: string | null;
  importance_score: string;
  confidence_score: string;
  sentiment_score: string | null;
  approval_status: Signal["approvalStatus"];
  created_at: string;
  first_seen_at: string;
  updated_at: string;
}

function mapSignal(row: DbSignalRow): Signal {
  return {
    signalId: row.signal_id,
    tenantId: row.tenant_id,
    sourceId: row.source_id,
    signalType: row.signal_type,
    title: row.title,
    summary: row.summary,
    fullText: row.full_text,
    competitorBrand: row.competitor_brand,
    diseaseState: row.disease_state,
    marketRegion: row.market_region,
    importanceScore: Number(row.importance_score),
    confidenceScore: Number(row.confidence_score),
    sentimentScore: row.sentiment_score === null ? null : Number(row.sentiment_score),
    approvalStatus: row.approval_status,
    createdAt: row.created_at,
    firstSeenAt: row.first_seen_at,
    updatedAt: row.updated_at
  };
}

export async function listSignalsByTenant(tenantId: string, limit = 50): Promise<Signal[]> {
  const rows = await query<DbSignalRow>(
    `
    SELECT signal_id, tenant_id, source_id, signal_type, title, summary, full_text,
           competitor_brand, disease_state, market_region, importance_score,
           confidence_score, sentiment_score, approval_status, created_at, first_seen_at, updated_at
    FROM signals
    WHERE tenant_id = $1
    ORDER BY updated_at DESC
    LIMIT $2
    `,
    [tenantId, limit]
  );

  return rows.map(mapSignal);
}

export type SignalListSort = "updated_desc" | "importance_desc" | "first_seen_desc";

export type ListSignalsByTenantOptions = {
  limit: number;
  offset: number;
  sort: SignalListSort;
  excludeTypes: SignalType[];
  from?: string;
  to?: string;
};

function sortClause(sort: SignalListSort): string {
  if (sort === "importance_desc") return "importance_score DESC, updated_at DESC";
  if (sort === "first_seen_desc") return "first_seen_at DESC, updated_at DESC";
  return "updated_at DESC";
}

function buildSignalsWhere(
  tenantId: string,
  options: Pick<ListSignalsByTenantOptions, "excludeTypes" | "from" | "to">
): { whereSql: string; params: unknown[] } {
  const params: unknown[] = [tenantId];
  const where: string[] = ["tenant_id = $1"];

  if (options.excludeTypes.length > 0) {
    params.push(options.excludeTypes);
    where.push(`signal_type <> ALL($${params.length}::signal_type[])`);
  }
  if (options.from) {
    params.push(options.from);
    where.push(`first_seen_at >= $${params.length}::timestamptz`);
  }
  if (options.to) {
    params.push(options.to);
    where.push(`first_seen_at <= $${params.length}::timestamptz`);
  }

  return { whereSql: where.join(" AND "), params };
}

export async function countSignalsByTenantFiltered(
  tenantId: string,
  options: Pick<ListSignalsByTenantOptions, "excludeTypes" | "from" | "to">
): Promise<number> {
  const { whereSql, params } = buildSignalsWhere(tenantId, options);
  const row = await one<{ total: string }>(
    `
    SELECT COUNT(*)::text AS total
    FROM signals
    WHERE ${whereSql}
    `,
    params
  );
  return Number(row?.total ?? 0);
}

export async function listSignalsByTenantFiltered(
  tenantId: string,
  options: ListSignalsByTenantOptions
): Promise<Signal[]> {
  const { whereSql, params } = buildSignalsWhere(tenantId, options);
  params.push(options.limit);
  const limitParam = params.length;
  params.push(options.offset);
  const offsetParam = params.length;

  const orderBy = sortClause(options.sort);
  const rows = await query<DbSignalRow>(
    `
    SELECT signal_id, tenant_id, source_id, signal_type, title, summary, full_text,
           competitor_brand, disease_state, market_region, importance_score,
           confidence_score, sentiment_score, approval_status, created_at, first_seen_at, updated_at
    FROM signals
    WHERE ${whereSql}
    ORDER BY ${orderBy}
    LIMIT $${limitParam}
    OFFSET $${offsetParam}
    `,
    params
  );

  return rows.map(mapSignal);
}

export async function getSignalById(tenantId: string, signalId: string): Promise<Signal | null> {
  const row = await one<DbSignalRow>(
    `
    SELECT signal_id, tenant_id, source_id, signal_type, title, summary, full_text,
           competitor_brand, disease_state, market_region, importance_score,
           confidence_score, sentiment_score, approval_status, created_at, first_seen_at, updated_at
    FROM signals
    WHERE tenant_id = $1 AND signal_id = $2
    `,
    [tenantId, signalId]
  );

  return row ? mapSignal(row) : null;
}

export async function createReportFromSignals(tenantId: string, title: string, reportType: string, bodyMarkdown: string, signalIds: string[]): Promise<{ report_id: string }> {
  const report = await one<{ report_id: string }>(
    `
    INSERT INTO reports (tenant_id, title, report_type, body_markdown, approval_status)
    VALUES ($1, $2, $3, $4, 'pending_review')
    RETURNING report_id
    `,
    [tenantId, title, reportType, bodyMarkdown]
  );

  if (!report) {
    throw new Error("Failed to create report");
  }

  for (const signalId of signalIds) {
    await query(
      `
      INSERT INTO report_signals (report_id, signal_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [report.report_id, signalId]
    );
  }

  return report;
}

export async function listPendingApprovals(tenantId: string): Promise<number> {
  const row = await one<{ total: string }>(
    `
    SELECT COUNT(*)::text AS total
    FROM (
      SELECT approval_id FROM approvals WHERE tenant_id = $1 AND approval_status = 'pending_review'
      UNION ALL
      SELECT report_id::uuid AS approval_id FROM reports WHERE tenant_id = $1 AND approval_status = 'pending_review'
    ) approval_union
    `,
    [tenantId]
  );

  return Number(row?.total ?? 0);
}
