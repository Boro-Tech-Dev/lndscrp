import { one, query } from "@landscrape/db";
import { listAlertsByTenant, getAlertApprovalSummary } from "../repositories/alertRepository";
import { listCongressThemes, listCongressTimeline } from "../repositories/congressRepository";
import { listCongressEvents } from "../repositories/congressEventRepository";
import { mapCongressEventToTile } from "./congressEventMapper";
import { listReportsByTenant } from "../repositories/reportRepository";
import { listProductsWithEnrichment } from "../repositories/productRepository";
import { mapProductToTile } from "./productTileMapper";

const COMPETITOR_ACTIONS = [
  "Generate competitor landscape briefing",
  "Review HCP channel assets across roster",
  "Review DTC patient-facing sites",
  "Open regulatory timeline in Research",
  "Export competitor roster snapshot",
] as const;

export async function getCompetitorWorkspace(tenantId: string) {
  const rows = await listProductsWithEnrichment(tenantId);
  const products = rows.map(mapProductToTile);
  const competitorCount = products.filter((p) => p.role === "competitor").length;
  const owned = products.find((p) => p.role === "owned");

  return {
    products,
    workspaceSummary: owned
      ? `${owned.brandName} workspace tracking ${competitorCount} competitors across SM and GIST.`
      : `Tracking ${competitorCount} competitors.`,
    actions: [...COMPETITOR_ACTIONS],
  };
}

export async function getCongressWorkspace(tenantId: string) {
  const [timeline, themes, stats, eventRows] = await Promise.all([
    listCongressTimeline(tenantId),
    listCongressThemes(tenantId),
    one<{ session_density: string; competitor_presence: string; }>(
      `
      SELECT
        COUNT(*)::text AS session_density,
        COUNT(DISTINCT competitor_brand)::text AS competitor_presence
      FROM signals
      WHERE tenant_id = $1
        AND signal_type = 'congress_intelligence'
      `,
      [tenantId]
    ),
    listCongressEvents(tenantId),
  ]);

  const events = eventRows.map(mapCongressEventToTile);
  const curatedSessionCount = events.reduce((n, e) => n + e.headlineSessions.length, 0);
  const curatedCompetitorBrands = new Set(
    events.flatMap((e) =>
      e.brands.filter((b) => b.role === "competitor").map((b) => b.brandName)
    )
  ).size;
  const signalSessionDensity = Number(stats?.session_density ?? 0);
  const signalCompetitorPresence = Number(stats?.competitor_presence ?? 0);

  return {
    events,
    timeline,
    eventState: {
      sessionDensity: curatedSessionCount + signalSessionDensity,
      competitorPresence: curatedCompetitorBrands + signalCompetitorPresence,
      kolEngagement: themes.length > 0 ? themes.length : events.length,
    },
    themes: themes.map((item) => item.label),
    outputs: ["Congress Summary", "KOL Commentary Digest", "Competitor Booth Readout"],
  };
}

export async function getAlertWorkspace(tenantId: string) {
  const [items, approvalSummary] = await Promise.all([
    listAlertsByTenant(tenantId),
    getAlertApprovalSummary(tenantId)
  ]);

  return {
    items,
    approvalSummary,
    escalationNotes: buildEscalationNotes(items)
  };
}

export async function getReportsWorkspace(tenantId: string) {
  const [items, exportCounts] = await Promise.all([
    listReportsByTenant(tenantId),
    query<{ report_type: string; total: string }>(
      `
      SELECT report_type, COUNT(*)::text AS total
      FROM reports
      WHERE tenant_id = $1
      GROUP BY report_type
      ORDER BY COUNT(*) DESC
      `,
      [tenantId]
    )
  ]);

  return {
    items,
    exportFormats: ['PDF', 'MD'],
    distributionControls: ['Analyst approval required', 'Tenant-branded output shell', 'Audit trail attached'],
    templates: exportCounts.map((row) => `${row.report_type} (${row.total})`)
  };
}

function buildEscalationNotes(items: Awaited<ReturnType<typeof listAlertsByTenant>>) {
  if (items.length === 0) {
    return ['No active alert escalations.'];
  }

  return items.slice(0, 2).map((item) => `Review ${item.severity.toLowerCase()} alert: ${item.item}`);
}
