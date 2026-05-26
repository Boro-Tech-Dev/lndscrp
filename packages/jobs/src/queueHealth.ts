import { Queue, type ConnectionOptions } from "bullmq";
import { getConfig } from "@landscrape/config";
import { getRedisConnection } from "./connection";
import { queueIdForJob } from "./queues";
import type { JobName } from "./types";

const ALL_JOB_NAMES: JobName[] = [
  "ingest:source",
  "pdf:extract",
  "portal:ingest",
  "social:ingest",
  "embed:signal",
  "export:report",
  "reconcile:scan",
  "inbound:normalize",
  "enrich:signal",
  "agent:turn",
  "agent:brief",
];

const USER_FACING_QUEUES: JobName[] = ["export:report", "agent:turn", "agent:brief"];

export interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
}

function queueFor(jobName: JobName): Queue {
  const connection = getRedisConnection() as unknown as ConnectionOptions;
  return new Queue(queueIdForJob(jobName), {
    connection,
    prefix: getConfig().queuePrefix,
  });
}

export async function getAllQueueDepths(): Promise<Record<JobName, QueueCounts>> {
  const result = {} as Record<JobName, QueueCounts>;
  for (const name of ALL_JOB_NAMES) {
    const q = queueFor(name);
    const counts = await q.getJobCounts("waiting", "delayed", "active");
    await q.close();
    result[name] = {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
    };
  }
  return result;
}

export async function getQueueDepth(jobName: JobName): Promise<number> {
  const q = queueFor(jobName);
  const counts = await q.getJobCounts("waiting", "delayed", "active");
  await q.close();
  return (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0);
}

export async function hasUserWorkPending(): Promise<boolean> {
  for (const name of USER_FACING_QUEUES) {
    const q = queueFor(name);
    const counts = await q.getJobCounts("waiting", "delayed", "active");
    await q.close();
    const total = (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0);
    if (total > 0) return true;
  }
  return false;
}

export async function logQueueDepths(label: string): Promise<void> {
  const config = getConfig();
  if (!config.logQueueDepth) return;

  const names: JobName[] = [
    "export:report",
    "agent:turn",
    "agent:brief",
    "embed:signal",
    "ingest:source",
    "social:ingest",
    "enrich:signal",
  ];
  const parts: string[] = [];
  for (const name of names) {
    parts.push(`${name}=${await getQueueDepth(name)}`);
  }
  console.log(`[queue-depth] ${label} ${parts.join(" ")}`);
}
