import { getConfig } from "@landscrape/config";
import Redis from "ioredis";

export type OllamaPriority = "user" | "interactive" | "pipeline" | "background";

const PRIORITY_RANK: Record<OllamaPriority, number> = {
  user: 0,
  interactive: 1,
  pipeline: 2,
  background: 3,
};

interface Waiter {
  priority: OllamaPriority;
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let activeSlots = 0;
const waitQueue: Waiter[] = [];

let redisClient: Redis | null = null;

function globalSlotsKey(): string {
  return `${getConfig().queuePrefix}:ollama:slots:active`;
}

function getRedis(): Redis | null {
  const max = getConfig().ollamaGlobalMaxConcurrent;
  if (max <= 0) return null;
  if (!redisClient) {
    redisClient = new Redis(getConfig().redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  return redisClient;
}

const ACQUIRE_GLOBAL_LUA = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local max = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
if current < max then
  redis.call('INCR', KEYS[1])
  redis.call('EXPIRE', KEYS[1], ttl)
  return 1
end
return 0
`;

const RELEASE_GLOBAL_LUA = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current > 0 then
  redis.call('DECR', KEYS[1])
end
return 1
`;

async function acquireGlobalSlot(priority: OllamaPriority): Promise<void> {
  const max = getConfig().ollamaGlobalMaxConcurrent;
  if (max <= 0) return;

  const redis = getRedis();
  if (!redis) return;

  if (redis.status !== "ready") {
    await redis.connect().catch(() => undefined);
  }

  const key = globalSlotsKey();
  const ttlSec = Math.max(60, Math.ceil(timeoutMsFor(priority) / 1000) + 30);
  const deadline = Date.now() + timeoutMsFor(priority);

  while (Date.now() < deadline) {
    try {
      const acquired = (await redis.eval(ACQUIRE_GLOBAL_LUA, 1, key, max, ttlSec)) as number;
      if (acquired === 1) return;
    } catch (err) {
      console.warn("[ollama] global slot redis error, using local limit only", err);
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  throw new Error(`Ollama global slot timeout (${priority}) after ${timeoutMsFor(priority)}ms`);
}

async function releaseGlobalSlot(): Promise<void> {
  const max = getConfig().ollamaGlobalMaxConcurrent;
  if (max <= 0) return;

  const redis = getRedis();
  if (!redis || redis.status !== "ready") return;

  try {
    await redis.eval(RELEASE_GLOBAL_LUA, 1, globalSlotsKey());
  } catch (err) {
    console.warn("[ollama] global slot release failed", err);
  }
}

function timeoutMsFor(priority: OllamaPriority): number {
  const c = getConfig();
  switch (priority) {
    case "user":
      return c.ollamaUserTimeoutMs;
    case "interactive":
      return c.ollamaInteractiveTimeoutMs;
    case "pipeline":
      return c.ollamaPipelineTimeoutMs;
    case "background":
      return c.ollamaBackgroundTimeoutMs;
  }
}

function drainQueue(): void {
  const max = getConfig().ollamaMaxConcurrent;
  while (activeSlots < max && waitQueue.length > 0) {
    waitQueue.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    const next = waitQueue.shift();
    if (!next) break;
    clearTimeout(next.timer);
    activeSlots += 1;
    next.resolve();
  }
}

function acquireLocalSlot(priority: OllamaPriority): Promise<void> {
  const max = getConfig().ollamaMaxConcurrent;
  if (activeSlots < max) {
    activeSlots += 1;
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = waitQueue.findIndex((w) => w.resolve === resolve);
      if (idx >= 0) waitQueue.splice(idx, 1);
      reject(new Error(`Ollama slot timeout (${priority}) after ${timeoutMsFor(priority)}ms`));
    }, timeoutMsFor(priority));

    waitQueue.push({ priority, resolve, reject, timer });
  });
}

function releaseLocalSlot(): void {
  activeSlots = Math.max(0, activeSlots - 1);
  drainQueue();
}

export async function withOllamaSlot<T>(priority: OllamaPriority, fn: () => Promise<T>): Promise<T> {
  await acquireGlobalSlot(priority);
  await acquireLocalSlot(priority);
  try {
    return await fn();
  } finally {
    releaseLocalSlot();
    await releaseGlobalSlot();
  }
}

export function ollamaFetchInit(priority: OllamaPriority): { signal: AbortSignal } {
  return { signal: AbortSignal.timeout(timeoutMsFor(priority)) };
}
