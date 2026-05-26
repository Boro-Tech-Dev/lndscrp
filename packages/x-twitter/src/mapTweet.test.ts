import test from "node:test";
import assert from "node:assert/strict";
import { mapTweetToItem, mapTweetsToItems } from "./mapTweet";
import type { RawTweet } from "./types";

const sampleTweet: RawTweet = {
  id: "1234567890",
  text: "Bezuclastinib shows promising results in systemic mastocytosis trials.",
  createdAt: "2026-05-20T14:30:00.000Z",
  author: { username: "oncology_news", name: "Oncology News", verified: true },
  metrics: { likes: 42, retweets: 10, replies: 3, views: 1200 },
  platform: "twitter",
};

test("mapTweetToItem produces LandScrape item fields", () => {
  const item = mapTweetToItem(sampleTweet);
  assert.ok(item);
  assert.equal(item.externalItemId, "1234567890");
  assert.match(item.title, /^@oncology_news:/);
  assert.equal(item.url, "https://x.com/oncology_news/status/1234567890");
  assert.equal(item.publishedAt, "2026-05-20T14:30:00.000Z");
  assert.equal(item.metadata.provider, "x");
  assert.equal(item.metadata.author, "@oncology_news");
  assert.equal(item.metadata.metrics?.likes, 42);
});

test("mapTweetToItem returns null for tombstones", () => {
  assert.equal(mapTweetToItem({ tombstone: true, id: null }), null);
});

test("mapTweetToItem throws when createdAt missing", () => {
  assert.throws(() => mapTweetToItem({ id: "1", text: "hello", author: { username: "a" } }), /missing createdAt/);
});

test("mapTweetsToItems filters invalid entries", () => {
  const items = mapTweetsToItems([sampleTweet, { tombstone: true }, { id: "2", text: "", createdAt: "2026-01-01T00:00:00.000Z" }]);
  assert.equal(items.length, 1);
});
