import { getConfig } from "@landscrape/config";
import type { FetchXItemsOptions, MappedXItem, RawTweet, XCredentials, XSourceConfig } from "./types";
import { mapApiTweetsToRaw, type XActionsApiTweet } from "./mapApiTweet";
import { mapTweetsToItems } from "./mapTweet";

interface XActionsSuccessEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  retryable?: boolean;
  retryAfterMs?: number;
}

interface SearchData {
  results?: XActionsApiTweet[];
}

interface TweetsData {
  tweets?: XActionsApiTweet[];
}

function asLimit(value: unknown, fallback: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

function searchProduct(filter: "latest" | "top"): string {
  return filter === "top" ? "top" : "latest";
}

function apiBaseUrl(): string {
  return getConfig().xactionsApiUrl.replace(/\/$/, "");
}

function buildHeaders(credentials: XCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Session-Cookie": credentials.authToken.trim(),
  };
  const key = getConfig().xactionsInternalKey;
  if (key) {
    headers["X-Landscrape-Internal-Key"] = key;
  }
  return headers;
}

async function postScrape<TData>(
  path: string,
  credentials: XCredentials,
  body: Record<string, unknown>
): Promise<TData> {
  const { xactionsApiTimeoutMs } = getConfig();
  const url = `${apiBaseUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), xactionsApiTimeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(credentials),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => ({}))) as XActionsSuccessEnvelope<TData> & {
      code?: string;
      retryAfterMs?: number;
    };

    if (res.status === 429) {
      const wait = json.retryAfterMs ?? 60_000;
      throw new Error(`XActions rate limited; retry after ${wait}ms`);
    }

    if (!res.ok || !json.success) {
      const msg = json.message ?? json.error ?? `HTTP ${res.status} from XActions ${path}`;
      throw new Error(msg);
    }

    if (!json.data) {
      throw new Error(`XActions ${path} returned no data`);
    }

    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

function applyBrowserMetadata(items: MappedXItem[]): MappedXItem[] {
  return items.map((item) => ({
    ...item,
    metadata: {
      ...item.metadata,
      rendered: true,
      scraper: "browser" as const,
    },
  }));
}

export async function fetchXItemsViaApi(
  sourceConfig: Record<string, unknown>,
  credentials: XCredentials,
  _options?: FetchXItemsOptions
): Promise<MappedXItem[]> {
  const cfg = sourceConfig as XSourceConfig;
  const mode = cfg.mode;
  if (mode !== "search" && mode !== "account" && mode !== "hashtag") {
    throw new Error(`source_config.mode must be search, account, or hashtag (got ${String(mode)})`);
  }

  const limit = asLimit(cfg.limit, 50, 200);
  const filter = cfg.filter === "top" ? "top" : "latest";
  let rawTweets: RawTweet[] = [];

  if (mode === "search") {
    const query = typeof cfg.query === "string" ? cfg.query.trim() : "";
    if (!query) throw new Error("source_config.query is required for mode=search");
    const data = await postScrape<SearchData>("/api/ai/scrape/search", credentials, {
      query,
      limit,
      filter: searchProduct(filter),
    });
    rawTweets = mapApiTweetsToRaw(data.results ?? []);
  } else if (mode === "account") {
    const username = typeof cfg.username === "string" ? cfg.username.trim().replace(/^@/, "") : "";
    if (!username) throw new Error("source_config.username is required for mode=account");
    const data = await postScrape<TweetsData>("/api/ai/scrape/tweets", credentials, {
      username,
      limit,
      includeReplies: Boolean(cfg.includeReplies),
    });
    rawTweets = mapApiTweetsToRaw(data.tweets ?? []);
  } else {
    const hashtag = typeof cfg.hashtag === "string" ? cfg.hashtag.trim().replace(/^#+/, "") : "";
    if (!hashtag) throw new Error("source_config.hashtag is required for mode=hashtag");
    const data = await postScrape<TweetsData>("/api/ai/scrape/hashtag", credentials, {
      hashtag,
      limit,
      filter: searchProduct(filter),
    });
    rawTweets = mapApiTweetsToRaw(data.tweets ?? []);
  }

  return applyBrowserMetadata(mapTweetsToItems(rawTweets));
}

/** Profile scrape via XActions API (for agent tools). */
export async function fetchXProfileViaApi(
  credentials: XCredentials,
  username: string
): Promise<Record<string, unknown>> {
  const clean = username.trim().replace(/^@/, "");
  if (!clean) throw new Error("username is required");
  return postScrape<Record<string, unknown>>("/api/ai/scrape/profile", credentials, { username: clean });
}
