import { one, query } from "@landscrape/db";
import { runBoundedEnrichment } from "@landscrape/intelligence-tools";
import { createWorkerForQueue } from "@landscrape/jobs";
import type { EnrichSignalPayload } from "@landscrape/jobs";
import { getConfig } from "@landscrape/config";
import { registerWorker } from "../workerRegistry";

async function fetchAgentEnrichment(
  tenantId: string,
  signalId: string,
  title: string,
  summary: string
): Promise<{ enrichment: Record<string, unknown>; citations: string[] }> {
  const config = getConfig();
  const url = `${config.agentEnrichInternalUrl.replace(/\/$/, "")}/v1/internal/enrich/signal`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Landscrape-Internal-Key": config.internalApiKey,
    },
    body: JSON.stringify({ tenantId, signalId, title, summary }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Agent enrich failed (${response.status}): ${body.slice(0, 300)}`);
  }

  return response.json() as Promise<{ enrichment: Record<string, unknown>; citations: string[] }>;
}

export function startEnrichWorker(): void {
  const { enrichConcurrency } = getConfig();
  registerWorker(createWorkerForQueue("enrich:signal", async (data) => {
    const payload = data as EnrichSignalPayload;
    const config = getConfig();
    const row = await one<{ signal_id: string; title: string; summary: string; metadata: Record<string, unknown> | null }>(
      `SELECT signal_id, title, summary, metadata FROM signals WHERE signal_id = $1 AND tenant_id = $2`,
      [payload.signalId, payload.tenantId]
    );
    if (!row) {
      console.warn(`[enrich] signal ${payload.signalId} not found`);
      return;
    }
    try {
      let enrichment: Record<string, unknown>;
      let citations: string[] = [];

      if (config.enrichUseAgent) {
        try {
          const agentResult = await fetchAgentEnrichment(
            payload.tenantId,
            payload.signalId,
            row.title,
            row.summary
          );
          enrichment = {
            ...agentResult.enrichment,
            citations: agentResult.citations,
          };
          citations = agentResult.citations;
        } catch (agentErr) {
          console.warn(`[enrich] agent failed for ${payload.signalId}, falling back to native`, agentErr);
          enrichment = await runBoundedEnrichment(payload.tenantId, payload.signalId, row.title, row.summary);
        }
      } else {
        enrichment = await runBoundedEnrichment(payload.tenantId, payload.signalId, row.title, row.summary);
      }

      if (citations.length > 0) {
        enrichment.citations = citations;
      }

      const metadata = { ...(row.metadata ?? {}), enrichment };
      await query(`UPDATE signals SET metadata = $1::jsonb, updated_at = NOW() WHERE signal_id = $2`, [
        JSON.stringify(metadata),
        payload.signalId,
      ]);
      console.log(`[enrich] signal ${payload.signalId} enriched`);
    } catch (err) {
      console.error(`[enrich] signal ${payload.signalId} failed (non-fatal)`, err);
    }
  }, enrichConcurrency));
  console.log("[worker] enrich:signal worker started");
}
