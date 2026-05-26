import { getConfig } from "@landscrape/config";
import { getAllQueueDepths } from "@landscrape/jobs";
import {
  listOllamaUsageRollup,
  listRecentAgentBriefJobs,
  listRecentAgentTurns,
  listRecentInboundEvents,
  listRecentJobRuns,
  listRecentReportExports,
  listRecentSignals,
  listRecentSourceChecks,
  listRecentToolAudit,
} from "../repositories/activityRepository";

export interface ActivityEvent {
  id: string;
  ts: string;
  category: string;
  status: string;
  summary: string;
  tenantSlug?: string;
  meta?: Record<string, unknown>;
}

export interface InfraHealthEntry {
  name: string;
  url: string;
  status: "ok" | "degraded" | "down";
  detail?: string;
}

export interface AdminActivityResponse {
  generatedAt: string;
  queues: Awaited<ReturnType<typeof getAllQueueDepths>>;
  events: ActivityEvent[];
  ollamaRollup: Awaited<ReturnType<typeof listOllamaUsageRollup>>;
  toolAudit: Awaited<ReturnType<typeof listRecentToolAudit>>;
  infra: InfraHealthEntry[];
}

function parseSinceParam(since?: string): Date {
  if (since) {
    const d = new Date(since);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(Date.now() - 60 * 60 * 1000);
}

function parseLimitParam(limit?: string): number {
  const n = limit ? Number(limit) : 100;
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(200, Math.floor(n));
}

async function probeHealth(name: string, url: string): Promise<InfraHealthEntry> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/health`, { signal: controller.signal });
    if (res.ok) {
      return { name, url, status: "ok" };
    }
    return { name, url, status: "degraded", detail: `HTTP ${res.status}` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unreachable";
    return { name, url, status: "down", detail };
  } finally {
    clearTimeout(timer);
  }
}

async function loadInfraHealth(): Promise<InfraHealthEntry[]> {
  const config = getConfig();
  const targets: Array<{ name: string; url: string }> = [
    { name: "agent", url: config.agentInternalUrl },
  ];
  if (config.mcpFdaUrl) targets.push({ name: "mcp-fda", url: config.mcpFdaUrl });
  if (config.mcpPubmedUrl) targets.push({ name: "mcp-pubmed", url: config.mcpPubmedUrl });
  if (config.mcpClinicaltrialsUrl) targets.push({ name: "mcp-clinicaltrials", url: config.mcpClinicaltrialsUrl });

  return Promise.all(targets.map((t) => probeHealth(t.name, t.url)));
}

export async function getAdminActivity(query: {
  since?: string;
  limit?: string;
}): Promise<AdminActivityResponse> {
  const since = parseSinceParam(query.since);
  const limit = parseLimitParam(query.limit);
  const opts = { since, limit };
  const rollupSince = new Date(Date.now() - 15 * 60 * 1000);

  const [
    queues,
    jobRuns,
    sourceChecks,
    agentTurns,
    briefJobs,
    exports,
    inbound,
    signals,
    ollamaRollup,
    toolAudit,
    infra,
  ] = await Promise.all([
    getAllQueueDepths(),
    listRecentJobRuns(opts),
    listRecentSourceChecks(opts),
    listRecentAgentTurns(opts),
    listRecentAgentBriefJobs(opts),
    listRecentReportExports(opts),
    listRecentInboundEvents(opts),
    listRecentSignals(opts),
    listOllamaUsageRollup(rollupSince),
    listRecentToolAudit(opts),
    loadInfraHealth(),
  ]);

  const events: ActivityEvent[] = [];

  for (const row of jobRuns) {
    events.push({
      id: `job_run:${row.job_run_id}`,
      ts: row.created_at.toISOString(),
      category: "job",
      status: row.status,
      summary: `${row.job_type} ${row.status}`,
      tenantSlug: row.tenant_slug ?? undefined,
      meta: { jobType: row.job_type, error: row.error_message, payload: row.payload_redacted },
    });
  }

  for (const row of sourceChecks) {
    events.push({
      id: `source_check:${row.source_check_id}`,
      ts: row.created_at.toISOString(),
      category: "source",
      status: row.status,
      summary: `${row.source_name}: ${row.status} (${row.result_count} items)`,
      tenantSlug: row.tenant_slug,
      meta: { error: row.error_message },
    });
  }

  for (const row of agentTurns) {
    events.push({
      id: `agent_turn:${row.turn_id}`,
      ts: row.created_at.toISOString(),
      category: "agent",
      status: row.status,
      summary: `Agent turn ${row.status}`,
      tenantSlug: row.tenant_slug,
      meta: { error: row.error_message },
    });
  }

  for (const row of briefJobs) {
    events.push({
      id: `agent_brief:${row.brief_job_id}`,
      ts: row.created_at.toISOString(),
      category: "agent",
      status: row.status,
      summary: `Brief "${row.title}": ${row.status}`,
      tenantSlug: row.tenant_slug,
      meta: { error: row.error_message },
    });
  }

  for (const row of exports) {
    events.push({
      id: `export:${row.export_id}`,
      ts: row.created_at.toISOString(),
      category: "export",
      status: row.status,
      summary: `Export ${row.format}: ${row.status}`,
      tenantSlug: row.tenant_slug,
      meta: { error: row.error_message },
    });
  }

  for (const row of inbound) {
    events.push({
      id: `inbound:${row.inbound_event_id}`,
      ts: row.created_at.toISOString(),
      category: "inbound",
      status: row.processing_status,
      summary: `Inbound ${row.channel}: ${row.processing_status}`,
      tenantSlug: row.tenant_slug,
      meta: { error: row.error_message },
    });
  }

  for (const row of signals) {
    events.push({
      id: `signal:${row.signal_id}`,
      ts: row.created_at.toISOString(),
      category: "signal",
      status: "created",
      summary: row.competitor_brand
        ? `Signal: ${row.title} (${row.competitor_brand})`
        : `Signal: ${row.title}`,
      tenantSlug: row.tenant_slug,
      meta: { signalType: row.signal_type, competitorBrand: row.competitor_brand },
    });
  }

  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return {
    generatedAt: new Date().toISOString(),
    queues,
    events: events.slice(0, limit),
    ollamaRollup,
    toolAudit,
    infra: [{ name: "api", url: `http://localhost:${getConfig().apiPort}`, status: "ok" }, ...infra],
  };
}
