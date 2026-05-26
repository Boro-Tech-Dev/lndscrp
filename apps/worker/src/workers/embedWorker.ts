import { embedText } from "@landscrape/ai";
import { query, one, recordOllamaUsage } from "@landscrape/db";
import type { EmbedSignalPayload } from "@landscrape/jobs";
import { createWorkerForQueue } from "@landscrape/jobs";
import { getConfig } from "@landscrape/config";
import { insertJobRun, completeJobRun, failJobRun } from "../jobRuns";
import { registerWorker } from "../workerRegistry";

async function handle(data: unknown, jobId?: string | undefined): Promise<void> {
  const p = data as EmbedSignalPayload;
  let runId: string | null = null;
  try {
    runId = await insertJobRun(p.tenantId, "embed:signal", jobId, { signalId: p.signalId });
    const row = await one<{ title: string; summary: string }>(
      `SELECT title, summary FROM signals WHERE tenant_id = $1 AND signal_id = $2`,
      [p.tenantId, p.signalId]
    );
    if (!row) {
      await completeJobRun(runId);
      return;
    }
    const { embedding: vec, usage } = await embedText(`${row.title}\n\n${row.summary}`, {
      priority: p.source === "backfill" ? "background" : "pipeline",
    });
    const literal = `[${vec.join(",")}]`;
    await query(`UPDATE signals SET search_embedding = $1::vector, updated_at = NOW() WHERE signal_id = $2`, [literal, p.signalId]);
    void recordOllamaUsage({
      tenantId: p.tenantId,
      operation: "embed",
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalDurationNs: usage.totalDurationNs,
      referenceType: "signal_embed",
      referenceId: p.signalId
    }).catch((err) => console.error("[ollama-usage] record failed (signal_embed)", err));
    await completeJobRun(runId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) await failJobRun(runId, msg);
    throw e;
  }
}

export function startEmbedWorker(): void {
  const { embedConcurrency } = getConfig();
  registerWorker(createWorkerForQueue("embed:signal", (data, id) => handle(data, id), embedConcurrency));
  console.log("[worker] embed:signal listening");
}
