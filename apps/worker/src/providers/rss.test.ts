import test from "node:test";
import assert from "node:assert/strict";
import { parseRssFeed } from "./rss";

const sample = `<?xml version="1.0"?>
<rss><channel>
<item><title>One</title><link>https://example.com/1</link><guid>g1</guid><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
<item><title>Two</title><link>https://example.com/2</link><guid>g1</guid><pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate></item>
<item><title>Three</title><link>https://example.com/3</link><guid>g3</guid></item>
</channel></rss>`;

test("parseRssFeed dedupes by guid when enabled", () => {
  const withDedupe = parseRssFeed(sample, { maxItems: 10, dedupeByGuid: true, sourceName: "t" });
  assert.equal(withDedupe.length, 2);
  assert.equal(withDedupe[0]?.title, "One");
  assert.equal(withDedupe[1]?.title, "Three");
});

test("parseRssFeed respects maxItems", () => {
  const items = parseRssFeed(sample, { maxItems: 1, dedupeByGuid: false, sourceName: "t" });
  assert.equal(items.length, 1);
});
