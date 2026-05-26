import { getConfig } from "@landscrape/config";
import { query } from "@landscrape/db";
import {
  backgroundJobOptions,
  createQueue,
  getQueueDepth,
  hasUserWorkPending,
  logQueueDepths,
} from "@landscrape/jobs";
import type { EmbedSignalPayload } from "@landscrape/jobs";
import { assertOllamaModelReady } from "./ollama";
import { loadActiveSources, resolveTenantId, runCycle } from "./ingestExecution";
import { probeSource } from "./probe";
import { startSchedulerLoop } from "./scheduler";
import { startIngestWorker } from "./workers/ingestWorker";
import { startPdfWorker } from "./workers/pdfWorker";
import { startPortalWorker } from "./workers/portalWorker";
import { startSocialWorker } from "./workers/socialWorker";
import { startEmbedWorker } from "./workers/embedWorker";
import { startExportWorker } from "./workers/exportWorker";
import { startReconcileWorker, startReconcileScheduler } from "./workers/reconcileWorker";
import { startInboundWorker } from "./workers/inboundWorker";
import { startEnrichWorker } from "./workers/enrichWorker";
import { startProductEnrichWorker } from "./workers/productEnrichWorker";
import { startImapInboundPoller } from "./imapInbound";
import { closeAllWorkers } from "./workerRegistry";

const OLLAMA_REQUIRED_ROLES = new Set([
  "legacy",
  "ingest",
  "inbound",
  "embed",
  "portal",
  "social",
  "full",
]);

async function runStartupProbes(tenantId: string): Promise<void> {
  const sources = await loadActiveSources(tenantId);
  console.log(`[probe] starting probes for ${sources.length} sources`);
  for (const source of sources) {
    if (!source.base_url) {
      console.warn(`[probe] source=${source.source_name} url=<none> skipped (no base_url)`);
      continue;
    }
    const result = await probeSource(source.base_url);
    const contentType = result.contentType ?? "<none>";
    if (result.ok) {
      console.log(
        `[probe] source=${source.source_name} url=${source.base_url} ok=true status=${result.status} ct=${contentType} ms=${result.durationMs}`
      );
    } else {
      console.warn(
        `[probe] source=${source.source_name} url=${source.base_url} ok=false status=${result.status ?? "null"} ct=${contentType} ms=${result.durationMs} error=${result.error ?? ""}`
      );
    }
  }
}

function startEmbedBackfillScheduler(): void {
  const config = getConfig();
  if (!config.embedBackfillEnabled) {
    console.log("[embed-scheduler] disabled (LANDSCRAPE_EMBED_BACKFILL_ENABLED=false)");
    return;
  }
  const tick = async () => {
    try {
      await logQueueDepths("embed-backfill");

      if (await hasUserWorkPending()) {
        console.log("[embed-scheduler] skipped — user work pending");
        return;
      }

      const embedDepth = await getQueueDepth("embed:signal");
      if (embedDepth > config.embedBackfillMaxQueueDepth) {
        console.log(`[embed-scheduler] skipped — embed queue depth ${embedDepth}`);
        return;
      }

      const rows = await query<{ signal_id: string; tenant_id: string }>(
        `SELECT signal_id, tenant_id FROM signals WHERE search_embedding IS NULL
         ORDER BY importance_score DESC NULLS LAST, created_at ASC
         LIMIT $1`,
        [config.embedBackfillBatchSize]
      );
      if (rows.length === 0) return;

      const q = createQueue("embed:signal");
      for (const r of rows) {
        const payload: EmbedSignalPayload = {
          tenantId: r.tenant_id,
          signalId: r.signal_id,
          source: "backfill",
        };
        await q.add("embed:signal", payload, backgroundJobOptions());
      }
      console.log(`[embed-scheduler] enqueued ${rows.length} embedding jobs`);
    } catch (e) {
      console.error("[embed-scheduler]", e);
    }
  };
  tick();
  setInterval(tick, config.embedBackfillIntervalMs);
}

function registerGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, closing workers…`);
    try {
      await closeAllWorkers();
      process.exit(0);
    } catch (err) {
      console.error("[worker] shutdown error", err);
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

async function main(): Promise<void> {
  const config = getConfig();
  const role = config.workerRole;

  if (role === "legacy") {
    if (OLLAMA_REQUIRED_ROLES.has(role)) {
      await assertOllamaModelReady(config.ollamaBaseUrl, config.ollamaModel);
    }
    const tenantId = await resolveTenantId(config.tenantSlug);
    await runStartupProbes(tenantId);
    await runCycle(config.tenantSlug);
    setInterval(() => {
      runCycle(config.tenantSlug).catch((error) => {
        console.error("[worker] cycle failed, crashing for restart", error);
        process.exit(1);
      });
    }, 1000 * 60 * 15);
    return;
  }

  if (OLLAMA_REQUIRED_ROLES.has(role)) {
    await assertOllamaModelReady(config.ollamaBaseUrl, config.ollamaModel);
  }
  registerGracefulShutdown();

  if (role === "scheduler") {
    startSchedulerLoop();
    return;
  }

  if (role === "ingest") {
    startIngestWorker();
    return;
  }

  if (role === "pdf") {
    startPdfWorker();
    return;
  }

  if (role === "portal") {
    startPortalWorker();
    return;
  }

  if (role === "social") {
    startSocialWorker();
    return;
  }

  if (role === "embed") {
    startEmbedWorker();
    startEmbedBackfillScheduler();
    return;
  }

  if (role === "export") {
    startExportWorker();
    return;
  }

  if (role === "reconcile") {
    startReconcileWorker();
    startReconcileScheduler();
    return;
  }

  if (role === "enrich") {
    startEnrichWorker();
    startProductEnrichWorker();
    return;
  }

  if (role === "enrich-product") {
    startProductEnrichWorker();
    return;
  }

  if (role === "inbound") {
    startInboundWorker();
    startImapInboundPoller();
    return;
  }

  if (role === "full") {
    startSchedulerLoop();
    startReconcileScheduler();
    startEmbedBackfillScheduler();
    startIngestWorker();
    startPdfWorker();
    startPortalWorker();
    startSocialWorker();
    startEmbedWorker();
    startExportWorker();
    startReconcileWorker();
    startInboundWorker();
    startImapInboundPoller();
    startEnrichWorker();
    startProductEnrichWorker();
    const tenantId = await resolveTenantId(config.tenantSlug).catch(() => null);
    if (tenantId) await runStartupProbes(tenantId);
    console.log("[worker] full stack started");
    return;
  }

  console.error(`Unknown LANDSCRAPE_WORKER_ROLE=${role}. Use legacy, scheduler, ingest, pdf, portal, social, embed, export, reconcile, inbound, enrich, enrich-product, or full.`);
  process.exit(1);
}

main().catch((error) => {
  console.error("[worker] fatal startup error", error);
  process.exit(1);
});
