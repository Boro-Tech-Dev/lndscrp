import { getConfig } from "@landscrape/config";
import { query } from "@landscrape/db";
import { createWorkerForQueue } from "@landscrape/jobs";
import type { ReconcileScanPayload } from "@landscrape/jobs";
import { insertJobRun, completeJobRun, failJobRun } from "../jobRuns";
import { registerWorker } from "../workerRegistry";

async function handle(data: unknown, jobId?: string): Promise<void> {
  const _p = data as ReconcileScanPayload;
  let runId: string | null = null;
  try {
    runId = await insertJobRun(null, "reconcile:scan", jobId, {});

    const stale = await query<{ tenant_id: string; source_id: string; source_name: string; last_checked_at: Date | null; poll_frequency_minutes: number }>(
      `SELECT tenant_id, source_id, source_name, last_checked_at, poll_frequency_minutes
       FROM sources
       WHERE is_active = TRUE`
    );

      const now = Date.now();
      const slackMs = 5 * 60 * 1000;
      for (const s of stale) {
        const freq = Math.max(1, s.poll_frequency_minutes) * 60 * 1000;
        const last = s.last_checked_at ? new Date(s.last_checked_at).getTime() : 0;
        if (last && now - last < freq + slackMs) continue;

        await query(
          `INSERT INTO audit_logs (tenant_id, action_type, target_type, target_id, metadata)
           VALUES ($1, 'reconcile_stale_source', 'source', $2, $3::jsonb)`,
          [s.tenant_id, s.source_id, JSON.stringify({ sourceName: s.source_name, lastCheckedAt: s.last_checked_at })]
        );
      }

    const failed = await query<{ tenant_id: string; source_id: string; source_name: string }>(
      `SELECT DISTINCT s.tenant_id, s.source_id, s.source_name
       FROM source_checks c
       JOIN sources s ON s.source_id = c.source_id
       WHERE c.status = 'failed' AND c.check_started_at > NOW() - INTERVAL '48 hours'`
    );

    for (const f of failed) {
      await query(
        `INSERT INTO audit_logs (tenant_id, action_type, target_type, target_id, metadata)
         VALUES ($1, 'reconcile_failed_checks', 'source', $2, $3::jsonb)`,
        [f.tenant_id, f.source_id, JSON.stringify({ sourceName: f.source_name })]
      );
    }

    const staleRunning = await query<{ source_check_id: string; tenant_id: string; source_id: string; source_name: string }>(
      `SELECT c.source_check_id, c.tenant_id, c.source_id, s.source_name
       FROM source_checks c
       JOIN sources s ON s.source_id = c.source_id
       WHERE c.status = 'running' AND c.check_started_at < NOW() - INTERVAL '30 minutes'`
    );

    for (const row of staleRunning) {
      await query(
        `UPDATE source_checks SET status = 'failed', check_completed_at = NOW(), error_message = $2 WHERE source_check_id = $1`,
        [row.source_check_id, "stale running check recovered by reconcile"]
      );
      await query(
        `INSERT INTO audit_logs (tenant_id, action_type, target_type, target_id, metadata)
         VALUES ($1, 'reconcile_stale_running_check', 'source_check', $2, $3::jsonb)`,
        [
          row.tenant_id,
          row.source_check_id,
          JSON.stringify({ sourceId: row.source_id, sourceName: row.source_name }),
        ]
      );
    }

    if (staleRunning.length > 0) {
      console.log(`[reconcile] recovered ${staleRunning.length} stale running source_checks`);
    }

    await completeJobRun(runId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) await failJobRun(runId, msg);
    throw e;
  }
}

export function startReconcileWorker(): void {
  const { reconcileConcurrency } = getConfig();
  registerWorker(createWorkerForQueue("reconcile:scan", (d, id) => handle(d, id), reconcileConcurrency));
  console.log("[worker] reconcile:scan listening");
}

export function startReconcileScheduler(): void {
  const { reconcileIntervalMs } = getConfig();
  import("@landscrape/jobs").then(({ createQueue, backgroundJobOptions }) => {
    const q = createQueue("reconcile:scan");
    const tick = () => {
      q
        .add("reconcile:scan", { mode: "scheduled" } satisfies ReconcileScanPayload, backgroundJobOptions())
        .catch((err: Error) => console.error("[reconcile-scheduler]", err));
    };
    tick();
    setInterval(tick, reconcileIntervalMs);
  });
}
