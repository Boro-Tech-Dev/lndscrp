import path from "path";
import os from "os";
import { one, query } from "@landscrape/db";
import { createWorkerForQueue } from "@landscrape/jobs";
import type { PortalIngestPayload } from "@landscrape/jobs";
import { getConfig } from "@landscrape/config";
import { fetchPortalRenderedItems, type PortalLoginConfig, type SourceRow } from "../adapters";
import { loadConnectorSecrets } from "../connectorSecrets";
import { insertJobRun, completeJobRun, failJobRun } from "../jobRuns";
import { loadSourceRow, processIngestionItems } from "../ingestExecution";
import { registerWorker } from "../workerRegistry";

async function handle(data: unknown, jobId?: string): Promise<void> {
  const p = data as PortalIngestPayload;
  let runId: string | null = null;
  try {
    runId = await insertJobRun(p.tenantId, "portal:ingest", jobId, { sourceId: p.sourceId, connectorId: p.connectorId });
    const source = await loadSourceRow(p.tenantId, p.sourceId);
    if (!source) {
      await completeJobRun(runId);
      return;
    }

    const merged = await loadConnectorSecrets(p.tenantId, p.connectorId);

    let login: PortalLoginConfig | null = null;
    const loginUrl = typeof merged.loginUrl === "string" ? merged.loginUrl : "";
    const username = typeof merged.username === "string" ? merged.username : "";
    const password = typeof merged.password === "string" ? merged.password : "";
    if (loginUrl && username && password) {
      login = {
        loginUrl,
        username,
        password,
        userSelector: String(merged.userSelector ?? "#username"),
        passSelector: String(merged.passSelector ?? "#password"),
        submitSelector: String(merged.submitSelector ?? 'button[type="submit"]'),
        postLoginWaitMs: typeof merged.postLoginWaitMs === "number" ? merged.postLoginWaitMs : 4000,
      };
    }

    const userDataDir = path.join(os.tmpdir(), "landscrape-portal", p.connectorId);
    const items = await fetchPortalRenderedItems(source as SourceRow, userDataDir, login);

    const check = await one<{ source_check_id: string }>(
      `INSERT INTO source_checks (tenant_id, source_id, status) VALUES ($1, $2, 'running') RETURNING source_check_id`,
      [p.tenantId, source.source_id]
    );
    if (!check) throw new Error("source_check failed");

    try {
      await processIngestionItems(p.tenantId, source, check.source_check_id, items);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await query(`UPDATE source_checks SET status = 'failed', check_completed_at = NOW(), error_message = $2 WHERE source_check_id = $1`, [
        check.source_check_id,
        message,
      ]);
      await query(`UPDATE sources SET last_checked_at = NOW(), last_status = 'failed', updated_at = NOW() WHERE source_id = $1`, [source.source_id]);
      throw e;
    }

    await completeJobRun(runId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) await failJobRun(runId, msg);
    throw e;
  }
}

export function startPortalWorker(): void {
  const { portalConcurrency } = getConfig();
  registerWorker(createWorkerForQueue("portal:ingest", (data, id) => handle(data, id), portalConcurrency));
  console.log("[worker] portal:ingest listening");
}
