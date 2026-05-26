import { getConfig } from "@landscrape/config";
import { one, query, recordOllamaUsage } from "@landscrape/db";
import { createWorkerForQueue } from "@landscrape/jobs";
import type { InboundNormalizePayload } from "@landscrape/jobs";
import { insertJobRun, completeJobRun, failJobRun } from "../jobRuns";
import { buildSignalDraft, type SourceRow } from "../adapters";
import { generateSummary } from "@landscrape/ai";
import { registerWorker } from "../workerRegistry";
import { buildSummaryPromptBody } from "../ingestUtils";

async function handle(data: unknown, jobId?: string): Promise<void> {
  const p = data as InboundNormalizePayload;
  let runId: string | null = null;
  try {
    runId = await insertJobRun(p.tenantId, "inbound:normalize", jobId, { inboundEventId: p.inboundEventId });
    const ev = await one<{ payload_summary: Record<string, unknown>; processing_status: string }>(
      `SELECT payload_summary, processing_status FROM inbound_events WHERE tenant_id = $1 AND inbound_event_id = $2`,
      [p.tenantId, p.inboundEventId]
    );
    if (!ev || ev.processing_status !== "pending") {
      if (runId) await completeJobRun(runId);
      return;
    }

    await query(`UPDATE inbound_events SET processing_status = 'processing' WHERE inbound_event_id = $1`, [p.inboundEventId]);

    const summary = ev.payload_summary ?? {};
    const title = typeof summary.title === "string" ? summary.title : "Inbound message";
    const body = typeof summary.body === "string" ? summary.body : JSON.stringify(summary);
    const sourceId = typeof summary.targetSourceId === "string" ? summary.targetSourceId : null;

    if (!sourceId) {
      throw new Error("inbound payload missing targetSourceId");
    }

    const source = await one<SourceRow>(
      `SELECT source_id, external_id, source_name, source_type, base_url, source_config FROM sources WHERE tenant_id = $1 AND source_id = $2`,
      [p.tenantId, sourceId]
    );
    if (!source) throw new Error("target source not found");

    const externalItemId = `inbound-${p.inboundEventId}`;
    const item = {
      externalItemId,
      title,
      summary: body.slice(0, 500),
      url: typeof summary.url === "string" ? summary.url : null,
      publishedAt: new Date().toISOString(),
      rawContent: body,
      metadata: { inbound: true, channel: p.channel },
    };

    const existing = await one<{ source_item_id: string }>(
      `SELECT source_item_id FROM source_items WHERE tenant_id = $1 AND source_id = $2 AND external_item_id = $3`,
      [p.tenantId, source.source_id, externalItemId]
    );
    let sourceItemId: string;
    if (existing) {
      sourceItemId = existing.source_item_id;
    } else {
      const ins = await one<{ source_item_id: string }>(
        `INSERT INTO source_items (tenant_id, source_id, external_item_id, item_title, item_summary, item_url, published_at, raw_content, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8::jsonb) RETURNING source_item_id`,
        [p.tenantId, source.source_id, externalItemId, item.title, item.summary, item.url, item.rawContent, JSON.stringify(item.metadata)]
      );
      if (!ins) throw new Error("source_item insert failed");
      sourceItemId = ins.source_item_id;
    }

    const draft = buildSignalDraft(source, item);
    const { summary: aiSummary, usage } = await generateSummary({
      title: draft.title,
      signalType: draft.signalType,
      summary: buildSummaryPromptBody(draft.summary, draft.fullText),
    }, { priority: "pipeline" });

    const existingSig = await one<{ signal_id: string }>(
      `SELECT signal_id FROM signals WHERE tenant_id = $1 AND source_item_id = $2`,
      [p.tenantId, sourceItemId]
    );
    let signalId: string;
    if (existingSig) {
      signalId = existingSig.signal_id;
    } else {
      const sig = await one<{ signal_id: string }>(
        `INSERT INTO signals (tenant_id, source_id, source_item_id, signal_type, title, summary, full_text, competitor_brand, disease_state, market_region, importance_score, confidence_score, approval_status, evidence_links)
         VALUES ($1,$2,$3,$4::signal_type,$5,$6,$7,$8,$9,$10,$11,$12,'pending_review',$13::jsonb)
         RETURNING signal_id`,
        [
          p.tenantId,
          source.source_id,
          sourceItemId,
          draft.signalType,
          draft.title,
          aiSummary,
          draft.fullText,
          draft.competitorBrand ?? null,
          draft.diseaseState ?? null,
          draft.marketRegion ?? null,
          draft.importanceScore,
          draft.confidenceScore,
          JSON.stringify(draft.evidenceLinks),
        ]
      );
      if (!sig) throw new Error("signal insert failed");
      signalId = sig.signal_id;
    }

    void recordOllamaUsage({
      tenantId: p.tenantId,
      operation: "generate",
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalDurationNs: usage.totalDurationNs,
      referenceType: "inbound_signal",
      referenceId: signalId
    }).catch((err) => console.error("[ollama-usage] record failed (inbound_signal)", err));

    await query(`UPDATE inbound_events SET processing_status = 'completed', error_message = NULL WHERE inbound_event_id = $1`, [p.inboundEventId]);
    await completeJobRun(runId);

    const { createQueue, pipelineJobOptions } = await import("@landscrape/jobs");
    const q = createQueue("embed:signal");
    await q.add(
      "embed:signal",
      { tenantId: p.tenantId, signalId, source: "inbound" },
      pipelineJobOptions()
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await query(`UPDATE inbound_events SET processing_status = 'failed', error_message = $2 WHERE inbound_event_id = $1`, [p.inboundEventId, msg]).catch(() => {});
    if (runId) await failJobRun(runId, msg);
    throw e;
  }
}

export function startInboundWorker(): void {
  const { inboundConcurrency } = getConfig();
  registerWorker(createWorkerForQueue("inbound:normalize", (d, id) => handle(d, id), inboundConcurrency));
  console.log("[worker] inbound:normalize listening");
}
