import type { RawTweet } from "./types";

export interface XActionsApiTweet {
  id?: string | number | null;
  text?: string;
  createdAt?: string | null;
  timestamp?: string | null;
  url?: string | null;
  username?: string;
  author?: {
    username?: string;
    displayName?: string;
    name?: string;
    verified?: boolean;
    profileImageUrl?: string | null;
    profileImage?: string | null;
  };
  metrics?: {
    likes?: number;
    retweets?: number;
    replies?: number;
    views?: number;
    quotes?: number;
    bookmarks?: number;
  };
  likes?: string | number;
  retweets?: string | number;
  replies?: string | number;
  views?: string | number;
  isReply?: boolean;
  isRetweet?: boolean;
  lang?: string | null;
}

function parseMetric(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeCreatedAt(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toISOString();
}

export function mapApiTweetToRaw(t: XActionsApiTweet): RawTweet | null {
  const id = t.id != null ? String(t.id) : "";
  if (!id) return null;

  const text = (t.text ?? "").trim();
  if (!text) return null;

  const username =
    t.author?.username?.trim() ||
    t.username?.trim() ||
    "";
  const createdAt = normalizeCreatedAt(t.createdAt ?? t.timestamp);

  const metrics = t.metrics ?? {
    likes: parseMetric(t.likes),
    retweets: parseMetric(t.retweets),
    replies: parseMetric(t.replies),
    views: parseMetric(t.views),
  };

  return {
    id,
    text,
    createdAt,
    author: {
      username: username || "unknown",
      name: t.author?.displayName ?? t.author?.name,
      verified: t.author?.verified,
      avatar: t.author?.profileImageUrl ?? t.author?.profileImage ?? null,
    },
    metrics,
    isReply: t.isReply,
    isRetweet: t.isRetweet,
    lang: t.lang ?? null,
    platform: "x",
  };
}

export function mapApiTweetsToRaw(tweets: XActionsApiTweet[]): RawTweet[] {
  const out: RawTweet[] = [];
  for (const t of tweets) {
    const raw = mapApiTweetToRaw(t);
    if (raw) out.push(raw);
  }
  return out;
}
