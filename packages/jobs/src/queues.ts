import type { JobName } from "./types";

/** BullMQ queue id (Redis keys are `{prefix}:{id}:...`). */
export const QUEUE_IDS: Record<JobName, string> = {
  "ingest:source": "ingest",
  "pdf:extract": "pdf",
  "portal:ingest": "portal",
  "social:ingest": "social",
  "embed:signal": "embed",
  "export:report": "export",
  "reconcile:scan": "reconcile",
  "inbound:normalize": "inbound",
  "enrich:signal": "enrich",
  "enrich:product": "enrich-product",
  "agent:turn": "agent-turn",
  "agent:brief": "agent-brief"
};

export function queueIdForJob(jobName: JobName): string {
  return QUEUE_IDS[jobName];
}
