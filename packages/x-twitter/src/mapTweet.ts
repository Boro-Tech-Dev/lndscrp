import type { MappedXItem, RawTweet } from "./types";

function takeChars(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function mapTweetToItem(tweet: RawTweet): MappedXItem | null {
  if (tweet.tombstone || !tweet.id) return null;

  const text = (tweet.text ?? "").trim();
  if (!text) return null;

  const username = tweet.author?.username?.trim() || "unknown";
  const handle = username.startsWith("@") ? username : `@${username}`;
  const createdAt = tweet.createdAt;
  if (!createdAt) {
    throw new Error(`Tweet ${tweet.id} from @${username} is missing createdAt`);
  }

  const metrics = tweet.metrics ?? {};
  const url = `https://x.com/${username.replace(/^@/, "")}/status/${tweet.id}`;

  return {
    externalItemId: String(tweet.id),
    title: `${handle}: ${takeChars(text, 120)}`,
    summary: takeChars(text, 280),
    url,
    publishedAt: createdAt,
    rawContent: `${text}\n\n---\n${JSON.stringify({ author: tweet.author, metrics, lang: tweet.lang }, null, 2)}`,
    metadata: {
      provider: "x",
      tweetId: String(tweet.id),
      author: handle,
      authorName: tweet.author?.name,
      metrics,
      rendered: false,
      isReply: tweet.isReply,
      isRetweet: tweet.isRetweet,
      lang: tweet.lang ?? null,
    },
  };
}

export function mapTweetsToItems(tweets: RawTweet[]): MappedXItem[] {
  const items: MappedXItem[] = [];
  for (const tweet of tweets) {
    const mapped = mapTweetToItem(tweet);
    if (mapped) items.push(mapped);
  }
  return items;
}
