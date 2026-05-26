declare module "xactions/scrapers/twitter/http" {
  export function createHttpScraper(options?: Record<string, unknown>): Promise<{
    client: {
      graphql: (queryId: string, operationName: string, variables: Record<string, unknown>) => Promise<unknown>;
    };
    scrapeTweets: (username: string, opts?: { limit?: number }) => Promise<unknown[]>;
    scrapeTweetsAndReplies: (username: string, opts?: { limit?: number }) => Promise<unknown[]>;
  }>;
}

declare module "xactions/src/scrapers/twitter/http/search.js" {
  export function searchTweets(
    client: { graphql: (queryId: string, operationName: string, variables: Record<string, unknown>) => Promise<unknown> },
    query: string,
    options?: { limit?: number; type?: string }
  ): Promise<unknown[]>;
  export function scrapeHashtag(
    client: { graphql: (queryId: string, operationName: string, variables: Record<string, unknown>) => Promise<unknown> },
    hashtag: string,
    options?: { limit?: number; type?: string }
  ): Promise<unknown[]>;
}
