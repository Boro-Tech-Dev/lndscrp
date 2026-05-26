import path from "path";
import { getConfig } from "@landscrape/config";
import { query, one, recordOllamaUsage } from "@landscrape/db";
import { generateSummary } from "@landscrape/ai";
import { createQueue, pipelineJobOptions } from "@landscrape/jobs";
import type { EmbedSignalPayload, PdfExtractPayload, EnrichSignalPayload } from "@landscrape/jobs";
import {
  buildSignalDraft,
  fetchSourceItems,
  normalizePublishedAt,
  type IngestedItem,
  type SourceRow,
} from "./adapters";
import { uploadArtifact } from "./storage";
import { politeFetch } from "./politeFetch";
import { isXSocialSource } from "./socialSource";
import { buildSummaryPromptBody } from "./ingestUtils";

const config = getConfig();

export async function resolveTenantId(tenantSlug: string): Promise<string> {
  const tenant = await one<{ tenant_id: string }>(`SELECT tenant_id FROM tenants WHERE tenant_slug = $1`, [tenantSlug]);
  if (!tenant) throw new Error(`Tenant ${tenantSlug} not found`);
  return tenant.tenant_id;
}

export async function loadActiveSources(tenantId: string): Promise<SourceRow[]> {
  return query<SourceRow>(
    `SELECT source_id, external_id, source_name, source_type, base_url, source_config FROM sources WHERE tenant_id = $1 AND is_active = TRUE ORDER BY source_name`,
    [tenantId]
  );
}

export async function loadSourceRow(tenantId: string, sourceId: string): Promise<SourceRow | null> {
  return one<SourceRow>(
    `SELECT source_id, external_id, source_name, source_type, base_url, source_config FROM sources WHERE tenant_id = $1 AND source_id = $2 AND is_active = TRUE`,
    [tenantId, sourceId]
  );
}

async function persistSourceItem(tenantId: string, source: SourceRow, item: IngestedItem): Promise<{ sourceItemId: string; isNew: boolean }> {
  const existing = await one<{ source_item_id: string }>(
    `SELECT source_item_id FROM source_items WHERE tenant_id = $1 AND source_id = $2 AND external_item_id = $3`,
    [tenantId, source.source_id, item.externalItemId]
  );
  if (existing) return { sourceItemId: existing.source_item_id, isNew: false };

  const publishedAt = normalizePublishedAt(item.publishedAt, source.source_name);

  const inserted = await one<{ source_item_id: string }>(
    `INSERT INTO source_items (tenant_id, source_id, external_item_id, item_title, item_summary, item_url, published_at, raw_content, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING source_item_id`,
    [
      tenantId,
      source.source_id,
      item.externalItemId,
      item.title,
      item.summary,
      item.url,
      publishedAt,
      item.rawContent,
      JSON.stringify(item.metadata ?? {}),
    ]
  );
  if (!inserted) throw new Error(`Failed to persist source item for ${item.title}`);
  return { sourceItemId: inserted.source_item_id, isNew: true };
}

async function persistArtifacts(tenantId: string, source: SourceRow, sourceCheckId: string, sourceItemId: string, item: IngestedItem): Promise<string[]> {
  const artifactUrls: string[] = [];
  if (!item.artifacts?.length) return artifactUrls;
  for (const artifact of item.artifacts) {
    const ext =
      path.extname(artifact.fileName) ||
      (artifact.artifactType === "screenshot" ? ".png" : artifact.artifactType === "pdf" ? ".pdf" : ".html");
    const storageKey = `${tenantId}/${source.source_type}/${source.source_id}/${sourceItemId}/${artifact.artifactType}${ext}`;
    const uploaded = await uploadArtifact(storageKey, artifact.body, artifact.contentType);
    const inserted = await one<{ source_asset_id: string }>(
      `INSERT INTO source_assets (tenant_id, source_id, source_check_id, source_item_id, asset_type, storage_provider, storage_bucket, storage_key, storage_url, content_type, byte_size, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) ON CONFLICT (tenant_id, source_item_id, asset_type, storage_key) DO UPDATE SET storage_url = EXCLUDED.storage_url, content_type = EXCLUDED.content_type, byte_size = EXCLUDED.byte_size, metadata = EXCLUDED.metadata, updated_at = NOW() RETURNING source_asset_id`,
      [
        tenantId,
        source.source_id,
        sourceCheckId,
        sourceItemId,
        artifact.artifactType,
        artifact.storageKind,
        config.storageBucket,
        uploaded.storageKey,
        uploaded.storageUrl,
        uploaded.contentType,
        uploaded.byteSize,
        JSON.stringify(artifact.metadata ?? {}),
      ]
    );
    if (!inserted) throw new Error(`Failed to persist source asset for ${item.title}`);
    artifactUrls.push(uploaded.storageUrl);
  }
  return artifactUrls;
}

async function persistSignalFromItem(
  tenantId: string,
  source: SourceRow,
  sourceCheckId: string,
  sourceItemId: string,
  item: IngestedItem,
  artifactUrls: string[]
): Promise<string | false> {
  const existing = await one<{ signal_id: string }>(
    `SELECT signal_id FROM signals WHERE tenant_id = $1 AND source_item_id = $2`,
    [tenantId, sourceItemId]
  );
  if (existing) return false;

  const draft = buildSignalDraft(source, item);
  const { summary: aiSummary, usage } = await generateSummary({
    title: draft.title,
    signalType: draft.signalType,
    summary: buildSummaryPromptBody(draft.summary, draft.fullText),
  }, { priority: "pipeline" });
  const evidenceLinks = [...draft.evidenceLinks, ...artifactUrls];
  const signal = await one<{ signal_id: string }>(
    `INSERT INTO signals (tenant_id, source_id, source_check_id, source_item_id, signal_type, title, summary, full_text, competitor_brand, disease_state, market_region, importance_score, confidence_score, approval_status, evidence_links) VALUES ($1,$2,$3,$4,$5::signal_type,$6,$7,$8,$9,$10,$11,$12,$13,'pending_review',$14::jsonb) RETURNING signal_id`,
    [
      tenantId,
      source.source_id,
      sourceCheckId,
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
      JSON.stringify(evidenceLinks),
    ]
  );
  if (!signal) throw new Error("Failed to create signal");
  void recordOllamaUsage({
    tenantId,
    operation: "generate",
    model: usage.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalDurationNs: usage.totalDurationNs,
    referenceType: "ingest_signal",
    referenceId: signal.signal_id
  }).catch((err) => console.error("[ollama-usage] record failed (ingest_signal)", err));
  for (const entity of draft.entities) {
    await query(`INSERT INTO signal_entities (signal_id, entity_type, entity_value) VALUES ($1, $2, $3)`, [signal.signal_id, entity.entityType, entity.entityValue]);
  }
  if (draft.importanceScore >= 80) {
    await query(
      `INSERT INTO alerts (tenant_id, signal_id, alert_title, alert_message, alert_level) VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, signal.signal_id, draft.title, draft.summary, draft.importanceScore >= 90 ? "critical" : "high"]
    );
  }
  const sourceCfg = source.source_config ?? {};
  const enrichFlag = sourceCfg.enrichWithAgent === true;
  if (enrichFlag || draft.importanceScore >= config.enrichImportanceThreshold) {
    const enrichQ = createQueue("enrich:signal");
    const enrichPayload: EnrichSignalPayload = { tenantId, signalId: signal.signal_id };
    await enrichQ.add("enrich:signal", enrichPayload, pipelineJobOptions()).catch((err) =>
      console.error("[enrich] enqueue failed (non-fatal)", err)
    );
  }
  return signal.signal_id;
}

export interface SourceCycleOutcome {
  items: number;
  newSignals: number;
  artifacts: number;
  notModified: boolean;
}

function supportsConditionalPrecheck(source: SourceRow): boolean {
  switch (source.source_type) {
    case "regulatory":
    case "payer":
      return true;
    case "congress": {
      const cfg = source.source_config ?? {};
      const format = String(cfg.format ?? "");
      return format === "xml" || format === "json";
    }
    default:
      return false;
  }
}

async function conditionalPreCheck(source: SourceRow): Promise<{ notModified: boolean; etag: string | null; lastModified: string | null }> {
  if (!source.base_url) return { notModified: false, etag: null, lastModified: null };
  if (!supportsConditionalPrecheck(source)) return { notModified: false, etag: null, lastModified: null };

  const cfg = source.source_config ?? {};
  const storedEtag = typeof cfg.last_etag === "string" ? cfg.last_etag : null;
  const storedLastModified = typeof cfg.last_modified === "string" ? cfg.last_modified : null;
  if (!storedEtag && !storedLastModified) {
    return { notModified: false, etag: null, lastModified: null };
  }

  const response = await politeFetch(source.base_url, {
    method: "GET",
    etag: storedEtag,
    lastModified: storedLastModified,
  });
  await response.text().catch(() => "");

  if (response.status === 304) {
    return { notModified: true, etag: storedEtag, lastModified: storedLastModified };
  }
  return {
    notModified: false,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

async function updateConditionalCache(sourceId: string, etag: string | null, lastModified: string | null): Promise<void> {
  if (!etag && !lastModified) return;
  const patch: Record<string, string> = {};
  if (etag) patch.last_etag = etag;
  if (lastModified) patch.last_modified = lastModified;
  await query(
    `UPDATE sources SET source_config = source_config || $2::jsonb, updated_at = NOW() WHERE source_id = $1`,
    [sourceId, JSON.stringify(patch)]
  );
}

function itemNeedsPdfExtract(item: IngestedItem): boolean {
  const cfg = item.metadata ?? {};
  if (cfg.extractPdf === true) return true;
  const url = item.url ?? "";
  if (/\.pdf(\?|$)/i.test(url)) return true;
  return false;
}

async function enqueueEmbedJob(tenantId: string, signalId: string): Promise<void> {
  const q = createQueue("embed:signal");
  const payload: EmbedSignalPayload = { tenantId, signalId, source: "ingest" };
  await q.add("embed:signal", payload, pipelineJobOptions());
}

async function enqueuePdfJob(payload: PdfExtractPayload): Promise<void> {
  const q = createQueue("pdf:extract");
  await q.add("pdf:extract", payload, pipelineJobOptions());
}

async function ingestItemLoop(
  tenantId: string,
  source: SourceRow,
  sourceCheckId: string,
  items: IngestedItem[]
): Promise<{ newSignals: number; artifacts: number }> {
  let newSignalCount = 0;
  let artifactCount = 0;
  for (const item of items) {
    const persisted = await persistSourceItem(tenantId, source, item);
    const artifactUrls = persisted.isNew ? await persistArtifacts(tenantId, source, sourceCheckId, persisted.sourceItemId, item) : [];
    artifactCount += artifactUrls.length;
    const newSignalId = await persistSignalFromItem(tenantId, source, sourceCheckId, persisted.sourceItemId, item, artifactUrls);
    if (newSignalId) {
      newSignalCount += 1;
      await enqueueEmbedJob(tenantId, newSignalId).catch((err) => console.error("[ingest] embed enqueue failed", err));
    }
    if (persisted.isNew && itemNeedsPdfExtract(item)) {
      await enqueuePdfJob({
        tenantId,
        sourceItemId: persisted.sourceItemId,
        sourceId: source.source_id,
        pdfUrl: item.url,
      }).catch((err) => console.error("[ingest] pdf enqueue failed", err));
    }
  }
  return { newSignals: newSignalCount, artifacts: artifactCount };
}

/** Portal / custom pipelines: persist items using the same path as standard ingest. */
export async function processIngestionItems(
  tenantId: string,
  source: SourceRow,
  sourceCheckId: string,
  items: IngestedItem[]
): Promise<SourceCycleOutcome> {
  const { newSignals, artifacts } = await ingestItemLoop(tenantId, source, sourceCheckId, items);
  await query(
    `UPDATE source_checks SET status = 'completed', check_completed_at = NOW(), result_count = $2, raw_payload = $3::jsonb WHERE source_check_id = $1`,
    [sourceCheckId, items.length, JSON.stringify({ source: source.source_name, ingested: items.length, newSignals, artifacts })]
  );
  await query(`UPDATE sources SET last_checked_at = NOW(), last_status = 'completed', updated_at = NOW() WHERE source_id = $1`, [source.source_id]);
  return { items: items.length, newSignals, artifacts, notModified: false };
}

export async function processSource(tenantId: string, source: SourceRow): Promise<SourceCycleOutcome> {
  const cfg = source.source_config ?? {};
  if (isXSocialSource(source)) {
    throw new Error(`Source ${source.source_name} uses X social ingest; schedule social:ingest instead`);
  }
  if (cfg.authMode === "portal") {
    throw new Error(`Source ${source.source_name} uses authMode=portal; schedule portal:ingest instead`);
  }

  const check = await one<{ source_check_id: string }>(
    `INSERT INTO source_checks (tenant_id, source_id, status) VALUES ($1, $2, 'running') RETURNING source_check_id`,
    [tenantId, source.source_id]
  );
  if (!check) throw new Error("Failed to create source_check record");
  await query(
    `UPDATE sources SET last_checked_at = NOW(), last_status = 'running', updated_at = NOW() WHERE source_id = $1`,
    [source.source_id]
  );
  try {
    const preCheck = await conditionalPreCheck(source);
    if (preCheck.notModified) {
      await query(
        `UPDATE source_checks SET status = 'completed', check_completed_at = NOW(), result_count = 0, raw_payload = $2::jsonb WHERE source_check_id = $1`,
        [check.source_check_id, JSON.stringify({ source: source.source_name, notModified: true })]
      );
      await query(
        `UPDATE sources SET last_checked_at = NOW(), last_status = 'not_modified', updated_at = NOW() WHERE source_id = $1`,
        [source.source_id]
      );
      return { items: 0, newSignals: 0, artifacts: 0, notModified: true };
    }
    const items = await fetchSourceItems(source);
    const { newSignals, artifacts } = await ingestItemLoop(tenantId, source, check.source_check_id, items);
    await query(
      `UPDATE source_checks SET status = 'completed', check_completed_at = NOW(), result_count = $2, raw_payload = $3::jsonb WHERE source_check_id = $1`,
      [check.source_check_id, items.length, JSON.stringify({ source: source.source_name, ingested: items.length, newSignals, artifacts })]
    );
    await query(
      `UPDATE sources SET last_checked_at = NOW(), last_status = 'completed', updated_at = NOW() WHERE source_id = $1`,
      [source.source_id]
    );
    await updateConditionalCache(source.source_id, preCheck.etag, preCheck.lastModified);
    return { items: items.length, newSignals, artifacts, notModified: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker failure";
    await query(
      `UPDATE source_checks SET status = 'failed', check_completed_at = NOW(), error_message = $2 WHERE source_check_id = $1`,
      [check.source_check_id, message]
    );
    await query(
      `UPDATE sources SET last_checked_at = NOW(), last_status = 'failed', updated_at = NOW() WHERE source_id = $1`,
      [source.source_id]
    );
    throw error;
  }
}

export async function runCycle(tenantSlug: string): Promise<void> {
  const tenantId = await resolveTenantId(tenantSlug);
  const sources = await loadActiveSources(tenantId);
  console.log(`[cycle] tenant=${tenantSlug} sources=${sources.length} starting`);
  for (const source of sources) {
    const cfg = source.source_config ?? {};
    if (isXSocialSource(source)) {
      console.log(`[cycle] source=${source.source_name} skipped (social x)`);
      continue;
    }
    if (cfg.authMode === "portal") {
      console.log(`[cycle] source=${source.source_name} skipped (portal auth)`);
      continue;
    }
    const started = Date.now();
    try {
      const outcome = await processSource(tenantId, source);
      const elapsed = Date.now() - started;
      const status = outcome.notModified ? "not_modified" : "ok";
      console.log(
        `[cycle] source=${source.source_name} status=${status} items=${outcome.items} newSignals=${outcome.newSignals} artifacts=${outcome.artifacts} ms=${elapsed}`
      );
    } catch (error) {
      const elapsed = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cycle] source=${source.source_name} status=FAILED ms=${elapsed} error=${message}`);
      throw error;
    }
  }
  console.log("[cycle] completed");
}
