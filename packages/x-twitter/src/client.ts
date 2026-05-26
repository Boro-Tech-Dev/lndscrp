import { buildCookieHeader } from "./cookies";
import type { XCredentials } from "./types";

export interface XHttpScraperClient {
  graphql: (queryId: string, operationName: string, variables: Record<string, unknown>) => Promise<unknown>;
}

export interface XHttpScraper {
  client: XHttpScraperClient;
  scrapeTweets: (username: string, opts?: { limit?: number }) => Promise<unknown[]>;
  scrapeTweetsAndReplies: (username: string, opts?: { limit?: number }) => Promise<unknown[]>;
}

export async function createXHttpScraper(credentials: XCredentials): Promise<XHttpScraper> {
  const cookies = buildCookieHeader(credentials);
  const mod = await import("xactions/scrapers/twitter/http");
  const createHttpScraper = (mod as { createHttpScraper: (opts: Record<string, unknown>) => Promise<XHttpScraper> })
    .createHttpScraper;
  return createHttpScraper({ cookies, rateLimitStrategy: "wait" });
}
