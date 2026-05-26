export interface XCredentials {
  authToken: string;
  ct0: string;
}

export type XSourceMode = "search" | "account" | "hashtag";

export interface XSourceConfig {
  provider?: string;
  mode?: XSourceMode;
  connectorId?: string;
  query?: string;
  username?: string;
  hashtag?: string;
  limit?: number;
  filter?: "latest" | "top";
  includeReplies?: boolean;
  /** Override global LANDSCRAPE_X_BACKEND for this source */
  scraper?: "api" | "http";
}

export interface RawTweetAuthor {
  id?: string | null;
  username?: string;
  name?: string;
  avatar?: string | null;
  verified?: boolean;
}

export interface RawTweetMetrics {
  likes?: number;
  retweets?: number;
  replies?: number;
  quotes?: number;
  bookmarks?: number;
  views?: number;
}

export interface RawTweet {
  id?: string | null;
  text?: string;
  createdAt?: string | null;
  author?: RawTweetAuthor;
  metrics?: RawTweetMetrics;
  tombstone?: boolean;
  platform?: string;
  isReply?: boolean;
  isRetweet?: boolean;
  lang?: string | null;
}

export interface MappedXItem {
  externalItemId: string;
  title: string;
  summary: string;
  url: string | null;
  publishedAt: string;
  rawContent: string;
  metadata: {
    provider: "x";
    tweetId: string;
    author?: string;
    authorName?: string;
    metrics?: RawTweetMetrics;
    rendered: boolean;
    scraper?: "browser" | "http";
    tombstone?: boolean;
    isReply?: boolean;
    isRetweet?: boolean;
    lang?: string | null;
  };
}

export interface FetchXItemsOptions {
  minGapMs?: number;
  backend?: "api" | "http";
}
