import { getConfig } from "@landscrape/config";
import { createRequire } from "module";
import path from "path";
import { createXHttpScraper, type XHttpScraper } from "./client";
import { parseCredentialsFromSecrets } from "./cookies";
import { mapTweetsToItems } from "./mapTweet";
import { fetchXItemsViaApi } from "./remoteClient";
import type { FetchXItemsOptions, MappedXItem, RawTweet, XCredentials, XSourceConfig } from "./types";

const nodeRequire = createRequire(__filename);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function defaultMinGapMs(): number {
  const raw = process.env.LANDSCRAPE_X_MIN_GAP_MS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 3000;
}

function asLimit(value: unknown, fallback: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

function normalizeHashtag(tag: string): string {
  return tag.trim().replace(/^#+/, "");
}

function searchProduct(filter: "latest" | "top"): "Latest" | "Top" {
  return filter === "top" ? "Top" : "Latest";
}

type SearchModule = {
  searchTweets: (
    client: XHttpScraper["client"],
    query: string,
    options?: { limit?: number; type?: string }
  ) => Promise<unknown[]>;
  scrapeHashtag: (
    client: XHttpScraper["client"],
    hashtag: string,
    options?: { limit?: number; type?: string }
  ) => Promise<unknown[]>;
};

let searchModulePromise: Promise<SearchModule> | null = null;

async function loadSearchModule(): Promise<SearchModule> {
  if (!searchModulePromise) {
    const searchPath = path.join(
      path.dirname(nodeRequire.resolve("xactions/package.json")),
      "src/scrapers/twitter/http/search.js"
    );
    searchModulePromise = import(searchPath) as Promise<SearchModule>;
  }
  return searchModulePromise;
}

export function parseXSourceConfig(cfg: Record<string, unknown>): XSourceConfig {
  return cfg as XSourceConfig;
}

function resolveBackend(cfg: XSourceConfig, options?: FetchXItemsOptions): "api" | "http" {
  if (options?.backend === "api" || options?.backend === "http") return options.backend;
  if (cfg.scraper === "api" || cfg.scraper === "http") return cfg.scraper;
  return getConfig().xBackend;
}

async function fetchXItemsHttp(
  sourceConfig: Record<string, unknown>,
  creds: XCredentials,
  options?: FetchXItemsOptions
): Promise<MappedXItem[]> {
  const cfg = parseXSourceConfig(sourceConfig);
  const mode = cfg.mode;
  if (mode !== "search" && mode !== "account" && mode !== "hashtag") {
    throw new Error(`source_config.mode must be search, account, or hashtag (got ${String(mode)})`);
  }

  const limit = asLimit(cfg.limit, 50, 200);
  const filter = cfg.filter === "top" ? "top" : "latest";
  const product = searchProduct(filter);
  const minGap = options?.minGapMs ?? defaultMinGapMs();

  const scraper = await createXHttpScraper(creds);
  let rawTweets: RawTweet[] = [];

  if (mode === "search") {
    const query = typeof cfg.query === "string" ? cfg.query.trim() : "";
    if (!query) throw new Error("source_config.query is required for mode=search");
    const searchMod = await loadSearchModule();
    rawTweets = (await searchMod.searchTweets(scraper.client, query, { limit, type: product })) as RawTweet[];
  } else if (mode === "account") {
    const username = typeof cfg.username === "string" ? cfg.username.trim().replace(/^@/, "") : "";
    if (!username) throw new Error("source_config.username is required for mode=account");
    if (cfg.includeReplies) {
      rawTweets = (await scraper.scrapeTweetsAndReplies(username, { limit })) as RawTweet[];
    } else {
      rawTweets = (await scraper.scrapeTweets(username, { limit })) as RawTweet[];
    }
  } else {
    const hashtag = normalizeHashtag(typeof cfg.hashtag === "string" ? cfg.hashtag : "");
    if (!hashtag) throw new Error("source_config.hashtag is required for mode=hashtag");
    await sleep(minGap);
    const searchMod = await loadSearchModule();
    rawTweets = (await searchMod.scrapeHashtag(scraper.client, hashtag, { limit, type: product })) as RawTweet[];
  }

  const items = mapTweetsToItems(rawTweets);
  return items.map((item) => ({
    ...item,
    metadata: { ...item.metadata, scraper: "http" as const },
  }));
}

export async function fetchXItems(
  sourceConfig: Record<string, unknown>,
  credentials: XCredentials | Record<string, unknown>,
  options?: FetchXItemsOptions
): Promise<MappedXItem[]> {
  const cfg = parseXSourceConfig(sourceConfig);
  const creds =
    "authToken" in credentials && "ct0" in credentials
      ? (credentials as XCredentials)
      : parseCredentialsFromSecrets(credentials as Record<string, unknown>);

  const backend = resolveBackend(cfg, options);
  if (backend === "api") {
    return fetchXItemsViaApi(sourceConfig, creds, options);
  }
  return fetchXItemsHttp(sourceConfig, creds, options);
}
