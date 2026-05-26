import { Queue, Worker, type ConnectionOptions, type JobsOptions } from "bullmq";
import { getConfig } from "@landscrape/config";
import { getRedisConnection } from "./connection";
import { queueIdForJob } from "./queues";
import type { JobName } from "./types";

export * from "./types";
export * from "./queues";
export * from "./queueHealth";
export * from "./reportExports";
export { getRedisConnection };

function redisPrefix(): string {
  return getConfig().queuePrefix;
}

export function createQueue(jobName: JobName): Queue {
  const connection = getRedisConnection() as unknown as ConnectionOptions;
  const id = queueIdForJob(jobName);
  return new Queue(id, { connection, prefix: redisPrefix() });
}

export function getQueueOptions(): { connection: ConnectionOptions; prefix: string } {
  return {
    connection: getRedisConnection() as unknown as ConnectionOptions,
    prefix: redisPrefix()
  };
}

function baseJobOptions(): JobsOptions {
  return {
    attempts: Number(process.env.LANDSCRAPE_JOB_ATTEMPTS ?? 3),
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 }
  };
}

function jobOptionsWithPriority(priority: number): JobsOptions {
  return { ...baseJobOptions(), priority };
}

export function userJobOptions(): JobsOptions {
  return jobOptionsWithPriority(getConfig().jobPriorityUser);
}

export function interactiveJobOptions(): JobsOptions {
  return jobOptionsWithPriority(getConfig().jobPriorityInteractive);
}

export function pipelineJobOptions(): JobsOptions {
  return jobOptionsWithPriority(getConfig().jobPriorityPipeline);
}

export function scheduledJobOptions(): JobsOptions {
  return jobOptionsWithPriority(getConfig().jobPriorityScheduled);
}

export function backgroundJobOptions(): JobsOptions {
  return jobOptionsWithPriority(getConfig().jobPriorityBackground);
}

/** @deprecated Use scheduledJobOptions() or a tier-specific helper. */
export function defaultJobOptions(): JobsOptions {
  return scheduledJobOptions();
}

export function createWorkerForQueue(
  jobName: JobName,
  processor: (data: unknown, bullmqJobId?: string) => Promise<void>,
  concurrency: number
): Worker {
  const { connection, prefix: p } = getQueueOptions();
  const id = queueIdForJob(jobName);
  return new Worker(
    id,
    async (job) => {
      await processor(job.data, job.id);
    },
    { connection, prefix: p, concurrency }
  );
}
