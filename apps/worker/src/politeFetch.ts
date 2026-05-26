import { getConfig } from "@landscrape/config";

const JITTER_MAX_MS = 2_000;
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30_000;

interface HostState {
  lastFetchAt: number;
  chain: Promise<void>;
}
const hostState = new Map<string, HostState>();

function userAgent(): string {
  const c = getConfig();
  return `LandScrapeBot/0.2 (+${c.contactUrl}; mailto:${c.contactEmail})`;
}

function minGapMsForHost(host: string): number {
  const c = getConfig();
  if (host === "eutils.ncbi.nlm.nih.gov") return c.eutilsMinGapMs;
  return c.fetchMinGapMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostKey(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

async function waitForHostSlot(host: string): Promise<void> {
  const existing = hostState.get(host);
  const minGap = minGapMsForHost(host);
  const runner = async (previous: Promise<void>): Promise<void> => {
    await previous;
    const now = Date.now();
    const state = hostState.get(host);
    if (state) {
      const elapsed = now - state.lastFetchAt;
      if (elapsed < minGap) {
        await sleep(minGap - elapsed);
      }
    }
    const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
    if (jitter > 0) await sleep(jitter);
  };
  const next = runner(existing?.chain ?? Promise.resolve());
  hostState.set(host, {
    lastFetchAt: existing?.lastFetchAt ?? 0,
    chain: next.catch(() => undefined),
  });
  await next;
}

function markHostFetched(host: string): void {
  const state = hostState.get(host);
  hostState.set(host, {
    lastFetchAt: Date.now(),
    chain: state?.chain ?? Promise.resolve(),
  });
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds) * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

export interface PoliteFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
}

export async function politeFetch(url: string, options: PoliteFetchOptions = {}): Promise<Response> {
  const host = hostKey(url);
  const method = (options.method ?? "GET").toUpperCase();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const cfg = getConfig();
  const baseHeaders: Record<string, string> = {
    "user-agent": userAgent(),
    from: cfg.contactEmail,
    accept: "application/json, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
    ...(options.headers ?? {}),
  };
  if (options.etag) baseHeaders["if-none-match"] = options.etag;
  if (options.lastModified) baseHeaders["if-modified-since"] = options.lastModified;

  let attempt = 0;
  let lastStatus = 0;
  let lastStatusText = "";
  while (attempt <= MAX_RETRIES) {
    await waitForHostSlot(host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: baseHeaders,
        body: options.body as BodyInit | undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      markHostFetched(host);
    }

    if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
      lastStatus = response.status;
      lastStatusText = response.statusText;
      attempt += 1;
      if (attempt > MAX_RETRIES) break;
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      const backoffMs = retryAfterMs ?? Math.min(30_000, 2_000 * 2 ** (attempt - 1));
      console.warn(
        `[politeFetch] ${method} ${url} -> ${response.status} ${response.statusText}; retrying in ${backoffMs}ms (attempt ${attempt}/${MAX_RETRIES})`
      );
      await sleep(backoffMs);
      continue;
    }

    return response;
  }

  throw new Error(
    `politeFetch gave up on ${method} ${url} after ${MAX_RETRIES} retries; last status ${lastStatus} ${lastStatusText}`
  );
}

export async function politeFetchText(url: string, options: PoliteFetchOptions = {}): Promise<string> {
  const response = await politeFetch(url, options);
  if (response.status === 304) {
    throw new Error(`politeFetchText: unexpected 304 for ${url}; caller should use politeFetch to branch on not-modified`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "<unreadable body>");
    throw new Error(`politeFetchText: ${response.status} ${response.statusText} for ${url}: ${body.slice(0, 500)}`);
  }
  return response.text();
}
