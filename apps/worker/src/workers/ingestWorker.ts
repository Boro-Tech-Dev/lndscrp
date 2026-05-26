import { createWorkerForQueue } from "@landscrape/jobs";
import type { IngestSourcePayload } from "@landscrape/jobs";
import { getConfig } from "@landscrape/config";
import { insertJobRun, completeJobRun, failJobRun } from "../jobRuns";
import { loadSourceRow, processSource } from "../ingestExecution";
import { registerWorker } from "../workerRegistry";

async function handle(data: unknown, jobId?: string): Promise<void> {
  const p = data as IngestSourcePayload;
  let runId: string | null = null;
  try {
    runId = await insertJobRun(p.tenantId, "ingest:source", jobId, { sourceId: p.sourceId });
    const source = await loadSourceRow(p.tenantId, p.sourceId);
    if (!source) {
      await completeJobRun(runId);
      return;
    }
    console.log(`[ingest] start source=${source.source_name} jobId=${jobId ?? ""}`);
    const outcome = await processSource(p.tenantId, source);
    console.log(
      `[ingest] done source=${source.source_name} items=${outcome.items} newSignals=${outcome.newSignals} notModified=${outcome.notModified}`
    );
    await completeJobRun(runId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) await failJobRun(runId, msg);
    throw e;
  }
}

export function startIngestWorker(): void {
  const { ingestConcurrency } = getConfig();
  registerWorker(createWorkerForQueue("ingest:source", (data, id) => handle(data, id), ingestConcurrency));
  console.log("[worker] ingest:source listening");
}
