import { getConfig } from "@landscrape/config";
import { query } from "@landscrape/db";
import { createQueue, logQueueDepths, scheduledJobOptions } from "@landscrape/jobs";
import type { IngestSourcePayload, PortalIngestPayload, SocialIngestPayload } from "@landscrape/jobs";
import { isXSocialSource, xSocialConnectorId } from "./socialSource";
import { enqueueDueProductEnrichments } from "./productEnrichScheduler";
import { selectDueForEnqueue, type DueSourceCandidate } from "./schedulerUtils";

type DueSourceRow = DueSourceCandidate;

async function loadRunningSourceIds(): Promise<Set<string>> {
  const running = await query<{ source_id: string }>(
    `SELECT DISTINCT source_id FROM source_checks WHERE status = 'running'`
  );
  return new Set(running.map((r) => r.source_id));
}

export async function enqueueDueSources(): Promise<number> {
  const { schedulerBurstLimit } = getConfig();
  const rows = await query<DueSourceRow>(
    `SELECT s.source_id, s.tenant_id, t.tenant_slug, s.source_type, s.poll_frequency_minutes, s.last_checked_at, s.source_config
     FROM sources s
     JOIN tenants t ON t.tenant_id = s.tenant_id
     WHERE s.is_active = TRUE`
  );

  const runningIds = await loadRunningSourceIds();
  const ingestQ = createQueue("ingest:source");
  const portalQ = createQueue("portal:ingest");
  const socialQ = createQueue("social:ingest");
  const now = Date.now();
  const dueCandidates: DueSourceRow[] = [];

  for (const row of rows) {
    if (runningIds.has(row.source_id)) continue;

    const freqMs = Math.max(1, row.poll_frequency_minutes) * 60 * 1000;
    const last = row.last_checked_at ? new Date(row.last_checked_at).getTime() : 0;
    const due = !last || now - last >= freqMs;
    if (!due) continue;

    dueCandidates.push(row);
  }

  const { social: socialToEnqueue, other: otherToEnqueue } = selectDueForEnqueue(
    dueCandidates,
    schedulerBurstLimit,
    isXSocialSource
  );
  const toEnqueue = [...socialToEnqueue, ...otherToEnqueue];
  let enqueued = 0;

  for (const row of toEnqueue) {
    const freqMs = Math.max(1, row.poll_frequency_minutes) * 60 * 1000;
    const cfg = row.source_config ?? {};
    if (isXSocialSource(row)) {
      const connectorId = xSocialConnectorId(row);
      const payload: SocialIngestPayload = {
        tenantId: row.tenant_id,
        sourceId: row.source_id,
        connectorId,
      };
      await socialQ.add("social:ingest", payload, {
        ...scheduledJobOptions(),
        jobId: `social-${row.source_id}-${Math.floor(now / freqMs)}`,
      });
    } else if (cfg.authMode === "portal") {
      const connectorId = typeof cfg.connectorId === "string" ? cfg.connectorId : "";
      if (!connectorId) {
        console.warn(`[scheduler] portal source ${row.source_id} missing connectorId`);
        continue;
      }
      const payload: PortalIngestPayload = {
        tenantId: row.tenant_id,
        sourceId: row.source_id,
        connectorId,
      };
      await portalQ.add("portal:ingest", payload, {
        ...scheduledJobOptions(),
        jobId: `portal-${row.source_id}-${Math.floor(now / freqMs)}`,
      });
    } else {
      const payload: IngestSourcePayload = {
        tenantId: row.tenant_id,
        sourceId: row.source_id,
        tenantSlug: row.tenant_slug,
      };
      await ingestQ.add("ingest:source", payload, {
        ...scheduledJobOptions(),
        jobId: `ingest-${row.source_id}-${Math.floor(now / freqMs)}`,
      });
    }
    enqueued += 1;
  }

  return enqueued;
}

export function startSchedulerLoop(): void {
  const { schedulerIntervalMs } = getConfig();
  const tick = () => {
    logQueueDepths("source-scheduler").catch(() => {});
    enqueueDueSources()
      .then((n) => console.log(`[scheduler] enqueued ${n} source jobs`))
      .catch((err) => console.error("[scheduler] failed", err));
    if (getConfig().productEnrichEnabled) {
      enqueueDueProductEnrichments()
        .then((n) => console.log(`[scheduler] enqueued ${n} product enrichment jobs`))
        .catch((err) => console.error("[scheduler] product enrich failed", err));
    }
  };
  tick();
  setInterval(tick, schedulerIntervalMs);
}
