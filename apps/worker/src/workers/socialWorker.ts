import { getConfig } from "@landscrape/config";
import { query, one } from "@landscrape/db";
import { createWorkerForQueue } from "@landscrape/jobs";
import type { SocialIngestPayload } from "@landscrape/jobs";
import { fetchXItems, parseCredentialsFromSecrets } from "@landscrape/x-twitter";
import { loadConnectorSecrets } from "../connectorSecrets";
import { loadSourceRow, processIngestionItems } from "../ingestExecution";
import type { IngestedItem } from "../ingestTypes";
import { insertJobRun, completeJobRun, failJobRun } from "../jobRuns";
import { registerWorker } from "../workerRegistry";

async function handle(data: unknown, jobId?: string): Promise<void> {
  const p = data as SocialIngestPayload;
  let runId: string | null = null;
  try {
    runId = await insertJobRun(p.tenantId, "social:ingest", jobId, {
      sourceId: p.sourceId,
      connectorId: p.connectorId,
    });
    const source = await loadSourceRow(p.tenantId, p.sourceId);
    if (!source) {
      await completeJobRun(runId);
      return;
    }

    const merged = await loadConnectorSecrets(p.tenantId, p.connectorId);
    parseCredentialsFromSecrets(merged);

    const mapped = await fetchXItems(source.source_config ?? {}, merged);
    const items: IngestedItem[] = mapped.map((m) => ({
      externalItemId: m.externalItemId,
      title: m.title,
      summary: m.summary,
      url: m.url,
      publishedAt: m.publishedAt,
      rawContent: m.rawContent,
      metadata: m.metadata,
    }));

    const check = await one<{ source_check_id: string }>(
      `INSERT INTO source_checks (tenant_id, source_id, status) VALUES ($1, $2, 'running') RETURNING source_check_id`,
      [p.tenantId, source.source_id]
    );
    if (!check) throw new Error("source_check failed");

    try {
      await processIngestionItems(p.tenantId, source, check.source_check_id, items);
      await query(`UPDATE connectors SET last_sync_at = NOW(), updated_at = NOW() WHERE connector_id = $1`, [
        p.connectorId,
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await query(`UPDATE source_checks SET status = 'failed', check_completed_at = NOW(), error_message = $2 WHERE source_check_id = $1`, [
        check.source_check_id,
        message,
      ]);
      await query(`UPDATE sources SET last_checked_at = NOW(), last_status = 'failed', updated_at = NOW() WHERE source_id = $1`, [
        source.source_id,
      ]);
      throw e;
    }

    await completeJobRun(runId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) await failJobRun(runId, msg);
    throw e;
  }
}

export function startSocialWorker(): void {
  const { socialConcurrency } = getConfig();
  registerWorker(createWorkerForQueue("social:ingest", (data, id) => handle(data, id), socialConcurrency));
  console.log("[worker] social:ingest listening");
}
