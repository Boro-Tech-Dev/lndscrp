import assert from "node:assert/strict";
import test from "node:test";
import { mapApiTweetToRaw, mapApiTweetsToRaw } from "./mapApiTweet";
import { mapTweetToItem } from "./mapTweet";

test("mapApiTweetToRaw maps search result shape", () => {
  const raw = mapApiTweetToRaw({
    id: "123",
    text: "Hello world",
    createdAt: "2024-01-15T12:00:00.000Z",
    author: { username: "nichxbt", displayName: "Nich", verified: true },
    metrics: { likes: 10, retweets: 2, replies: 1, views: 100 },
  });
  assert.ok(raw);
  assert.equal(raw.id, "123");
  assert.equal(raw.author?.username, "nichxbt");
  assert.equal(raw.metrics?.likes, 10);
});

test("mapApiTweetToRaw rejects empty text", () => {
  assert.equal(mapApiTweetToRaw({ id: "1", text: "  " }), null);
});

test("mapApiTweetsToRaw filters invalid rows", () => {
  const list = mapApiTweetsToRaw([
    { id: "1", text: "a", createdAt: "2024-01-01T00:00:00Z", author: { username: "u" } },
    { id: "2", text: "" },
  ]);
  assert.equal(list.length, 1);
});

test("mapTweetToItem works with API-mapped tweet", () => {
  const raw = mapApiTweetToRaw({
    id: "99",
    text: "Signal text",
    createdAt: "2024-06-01T08:00:00.000Z",
    author: { username: "kol" },
  });
  assert.ok(raw);
  const item = mapTweetToItem(raw);
  assert.ok(item);
  assert.equal(item.externalItemId, "99");
  assert.match(item.title, /@kol/);
});
