import type { IngestedItem } from "../ingestTypes";
import { buildStableId, getFirstTagValue, stripTags } from "../ingestUtils";
import { normalizePublishedAt } from "../ingestUtils";

function itemBlocks(xml: string): string[] {
  return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi), ...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
}

export interface ParseRssOptions {
  maxItems: number;
  dedupeByGuid: boolean;
  sourceName: string;
}

/**
 * Parse RSS/Atom into items with configurable cap and optional dedupe by guid/link.
 */
export function parseRssFeed(xml: string, options: ParseRssOptions): IngestedItem[] {
  const blocks = itemBlocks(xml);
  const seen = new Set<string>();
  const out: IngestedItem[] = [];
  for (let index = 0; index < blocks.length; index++) {
    if (out.length >= options.maxItems) break;
    const block = blocks[index];
    const rawTitle = getFirstTagValue(block, ["title"]);
    if (!rawTitle || !rawTitle.trim()) {
      throw new Error(`RSS/Atom item ${index + 1} for source '${options.sourceName}' is missing <title>`);
    }
    const title = stripTags(rawTitle);
    const summary = stripTags(
      getFirstTagValue(block, ["description", "summary", "content", "content:encoded", "abstract"]) ?? ""
    );
    const url = getFirstTagValue(block, ["link", "id"]);
    const publishedRaw = getFirstTagValue(block, ["pubDate", "updated", "published", "dc:date"]);
    const publishedAt = normalizePublishedAt(publishedRaw, options.sourceName);
    const guid = getFirstTagValue(block, ["guid", "id"]);
    const dedupeKey = (guid || url || title).trim();
    if (options.dedupeByGuid && dedupeKey && seen.has(dedupeKey)) continue;
    if (dedupeKey) seen.add(dedupeKey);
    out.push({
      externalItemId: buildStableId([guid, url, title, publishedRaw]),
      title,
      summary: summary || title,
      url,
      publishedAt,
      rawContent: stripTags(block),
      metadata: { feedType: block.includes("<entry") ? "atom" : "rss" },
    });
  }
  return out;
}

/** Extract <link href="..."/> for Atom entries when <link>text</link> is empty */
export function enrichAtomLinks(xml: string, items: IngestedItem[]): IngestedItem[] {
  const blocks = itemBlocks(xml);
  return items.map((item, i) => {
    const block = blocks[i];
    if (!block || item.url) return item;
    const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
    if (hrefMatch?.[1]) {
      return { ...item, url: hrefMatch[1].trim() };
    }
    return item;
  });
}
