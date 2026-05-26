import { query } from "@landscrape/db";

export interface ActivityQueryOptions {
  since: Date;
  limit: number;
}

export async function listRecentJobRuns(opts: ActivityQueryOptions) {
  return query<{
    job_run_id: string;
    job_type: string;
    status: string;
    error_message: string | null;
    payload_redacted: Record<string, unknown>;
    created_at: Date;
    finished_at: Date | null;
    tenant_slug: string | null;
  }>(
    `
    SELECT jr.job_run_id, jr.job_type, jr.status, jr.error_message, jr.payload_redacted,
           jr.created_at, jr.finished_at, t.tenant_slug
    FROM job_runs jr
    LEFT JOIN tenants t ON t.tenant_id = jr.tenant_id
    WHERE jr.created_at >= $1
    ORDER BY jr.created_at DESC
    LIMIT $2
    `,
    [opts.since, opts.limit]
  );
}

export async function listRecentSourceChecks(opts: ActivityQueryOptions) {
  return query<{
    source_check_id: string;
    status: string;
    error_message: string | null;
    result_count: number;
    created_at: Date;
    source_name: string;
    tenant_slug: string;
  }>(
    `
    SELECT sc.source_check_id, sc.status, sc.error_message, sc.result_count, sc.created_at,
           s.source_name, t.tenant_slug
    FROM source_checks sc
    JOIN sources s ON s.source_id = sc.source_id
    JOIN tenants t ON t.tenant_id = sc.tenant_id
    WHERE sc.created_at >= $1
    ORDER BY sc.created_at DESC
    LIMIT $2
    `,
    [opts.since, opts.limit]
  );
}

export async function listRecentAgentTurns(opts: ActivityQueryOptions) {
  return query<{
    turn_id: string;
    status: string;
    error_message: string | null;
    created_at: Date;
    tenant_slug: string;
  }>(
    `
    SELECT at.turn_id, at.status, at.error_message, at.created_at, t.tenant_slug
    FROM agent_turns at
    JOIN tenants t ON t.tenant_id = at.tenant_id
    WHERE at.created_at >= $1
    ORDER BY at.created_at DESC
    LIMIT $2
    `,
    [opts.since, opts.limit]
  );
}

export async function listRecentAgentBriefJobs(opts: ActivityQueryOptions) {
  return query<{
    brief_job_id: string;
    title: string;
    status: string;
    error_message: string | null;
    created_at: Date;
    tenant_slug: string;
  }>(
    `
    SELECT ab.brief_job_id, ab.title, ab.status, ab.error_message, ab.created_at, t.tenant_slug
    FROM agent_brief_jobs ab
    JOIN tenants t ON t.tenant_id = ab.tenant_id
    WHERE ab.created_at >= $1
    ORDER BY ab.created_at DESC
    LIMIT $2
    `,
    [opts.since, opts.limit]
  );
}

export async function listRecentReportExports(opts: ActivityQueryOptions) {
  return query<{
    export_id: string;
    format: string;
    status: string;
    error_message: string | null;
    created_at: Date;
    tenant_slug: string;
  }>(
    `
    SELECT re.export_id, re.format, re.status, re.error_message, re.created_at, t.tenant_slug
    FROM report_exports re
    JOIN tenants t ON t.tenant_id = re.tenant_id
    WHERE re.created_at >= $1
    ORDER BY re.created_at DESC
    LIMIT $2
    `,
    [opts.since, opts.limit]
  );
}

export async function listRecentInboundEvents(opts: ActivityQueryOptions) {
  return query<{
    inbound_event_id: string;
    channel: string;
    processing_status: string;
    error_message: string | null;
    created_at: Date;
    tenant_slug: string;
  }>(
    `
    SELECT ie.inbound_event_id, ie.channel, ie.processing_status, ie.error_message,
           ie.created_at, t.tenant_slug
    FROM inbound_events ie
    JOIN tenants t ON t.tenant_id = ie.tenant_id
    WHERE ie.created_at >= $1
    ORDER BY ie.created_at DESC
    LIMIT $2
    `,
    [opts.since, opts.limit]
  );
}

export async function listRecentSignals(opts: ActivityQueryOptions) {
  return query<{
    signal_id: string;
    title: string;
    signal_type: string;
    competitor_brand: string | null;
    created_at: Date;
    tenant_slug: string;
  }>(
    `
    SELECT s.signal_id, s.title, s.signal_type::text AS signal_type, s.competitor_brand,
           s.created_at, t.tenant_slug
    FROM signals s
    JOIN tenants t ON t.tenant_id = s.tenant_id
    WHERE s.created_at >= $1
    ORDER BY s.created_at DESC
    LIMIT $2
    `,
    [opts.since, opts.limit]
  );
}

export async function listOllamaUsageRollup(since: Date) {
  return query<{
    operation: string;
    model: string;
    call_count: string;
    avg_duration_sec: string | null;
  }>(
    `
    SELECT operation, model, COUNT(*)::text AS call_count,
           ROUND(AVG(total_duration_ns) / 1e9, 2)::text AS avg_duration_sec
    FROM ollama_usage_events
    WHERE created_at >= $1
    GROUP BY operation, model
    ORDER BY COUNT(*) DESC
    LIMIT 20
    `,
    [since]
  );
}

export async function listRecentToolAudit(opts: ActivityQueryOptions) {
  return query<{
    audit_id: string;
    tool_id: string;
    status: string;
    duration_ms: number | null;
    created_at: Date;
    tenant_slug: string | null;
  }>(
    `
    SELECT ata.audit_id, ata.tool_id, ata.status, ata.duration_ms, ata.created_at, t.tenant_slug
    FROM agent_tool_audit ata
    LEFT JOIN tenants t ON t.tenant_id = ata.tenant_id
    WHERE ata.created_at >= $1
    ORDER BY ata.created_at DESC
    LIMIT $2
    `,
    [opts.since, opts.limit]
  );
}
