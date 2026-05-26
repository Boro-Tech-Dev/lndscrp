import assert from "node:assert/strict";
import test from "node:test";
import { mapApiTweetsToRaw } from "./mapApiTweet";

test("mapApiTweetsToRaw handles hashtag response tweets array", () => {
  const tweets = mapApiTweetsToRaw([
    {
      id: "555",
      text: "Hashtag post",
      createdAt: "2024-02-01T00:00:00Z",
      author: { username: "poster", displayName: "Poster" },
      metrics: { likes: 0, retweets: 0, replies: 0 },
    },
  ]);
  assert.equal(tweets.length, 1);
  assert.equal(tweets[0]?.id, "555");
});

test("remote client error envelope fields are documented for callers", () => {
  const sample = {
    success: false,
    error: "RATE_LIMITED",
    message: "Rate limited by X/Twitter",
    retryAfterMs: 60000,
  };
  assert.equal(sample.success, false);
  assert.ok(sample.retryAfterMs && sample.retryAfterMs > 0);
});
