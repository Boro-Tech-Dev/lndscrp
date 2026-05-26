import type { IngestedItem, PortalLoginConfig, SignalDraft, SourceRow } from "./ingestTypes";
export type { IngestedItem, PortalLoginConfig, SignalDraft, SourceArtifactDraft, SourceRow } from "./ingestTypes";
import { buildStableId, normalizePublishedAt, parsePubMedDate } from "./ingestUtils";
import { politeFetchText } from "./politeFetch";
import { routeIngestion } from "./providers/router";
import { parseRssFeed } from "./providers/rss";
import { fetchPortalRenderedItems } from "./renderedPage";

export { parsePubMedDate, normalizePublishedAt, buildStableId } from "./ingestUtils";
export { normalizeHtmlContent } from "./ingestUtils";
export { fetchPortalRenderedItems } from "./renderedPage";

export async function fetchText(url: string, init?: { headers?: Record<string, string> }): Promise<string> {
  return politeFetchText(url, { headers: init?.headers });
}

/** @deprecated Prefer parseRssFeed from providers/rss with options; kept for callers expecting full feed parse. */
export function parseRssOrAtom(xml: string, sourceName: string): IngestedItem[] {
  return parseRssFeed(xml, { maxItems: 500, dedupeByGuid: false, sourceName });
}

export async function fetchSourceItems(source: SourceRow): Promise<IngestedItem[]> {
  return routeIngestion(source);
}

const COMPETITOR_BRAND_PATTERNS: { pattern: RegExp; brand: string }[] = [
  { pattern: /bezuclastinib|cgt9486|cogent biosciences/i, brand: "Bezuclastinib" },
  { pattern: /avapritinib|ayvakit/i, brand: "Ayvakit" },
  { pattern: /midostaurin|rydapt/i, brand: "Rydapt" },
  { pattern: /ripretinib|qinlock/i, brand: "Qinlock" },
  { pattern: /imatinib|gleevec/i, brand: "Gleevec" },
  { pattern: /sunitinib|sutent/i, brand: "Sutent" },
  { pattern: /regorafenib|stivarga/i, brand: "Stivarga" },
];

function resolveCompetitorBrandFromText(text: string): string | undefined {
  for (const { pattern, brand } of COMPETITOR_BRAND_PATTERNS) {
    if (pattern.test(text)) return brand;
  }
  return undefined;
}

function configCompetitorBrand(source: SourceRow): string | undefined {
  const cfg = source.source_config ?? {};
  const v = cfg.competitorBrand;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function configChannel(source: SourceRow): "hcp" | "dtc" | undefined {
  const cfg = source.source_config ?? {};
  const ch = cfg.channel;
  return ch === "hcp" || ch === "dtc" ? ch : undefined;
}

export function buildSignalDraft(source: SourceRow, item: IngestedItem): SignalDraft {
  const text = `${item.title} ${item.summary} ${item.rawContent}`.toLowerCase();
  const sourceType = source.source_type;
  const channel = configChannel(source);
  let signalType: SignalDraft["signalType"] = "professional_discourse";
  if (sourceType === "competitor_site") signalType = "competitive_activity";
  else if (sourceType === "publication") signalType = "clinical_landscape";
  else if (sourceType === "congress") signalType = "congress_intelligence";
  else if (sourceType === "regulatory") signalType = "regulatory";
  else if (sourceType === "payer") signalType = "market_access";
  else if (sourceType === "social") signalType = "social_intelligence";
  else if (sourceType === "news" || sourceType === "press") signalType = "professional_discourse";
  let importanceScore = 58;
  if (/phase iii|launch|approval|warning|guidance|formulary|coverage|reimbursement|late-breaking|breaking/i.test(item.title + " " + item.summary)) {
    importanceScore += 24;
  }
  if (/safety|boxed warning|recall|priority review|accelerated approval/i.test(text)) importanceScore += 12;
  if (/bezuclastinib|cgt9486|cogent biosciences|summit trial|peak trial|apex trial|pdufa|nda accepted|nda submission|rtor|breakthrough therapy/i.test(text)) {
    importanceScore += 18;
  }
  if (/avapritinib|ayvakit|pioneer trial|pathfinder|explorer trial|elanestinib|blu-263/i.test(text)) {
    importanceScore += 8;
  }
  if (channel === "hcp" && /prescribing information|full prescribing|dosage and administration|rems|medication guide|label update|formulary|prior auth/i.test(text)) {
    importanceScore += 10;
  }
  if (channel === "dtc" && /copay|co-pay|patient support|savings card|financial assistance|now approved|talk to your doctor|patient brochure|direct-to-consumer|dtc/i.test(text)) {
    importanceScore += 10;
  }
  if (channel === "dtc" && /bezuclastinib|cogent/i.test(text)) {
    importanceScore += 12;
  }
  const metrics = item.metadata?.metrics as { likes?: number; retweets?: number } | undefined;
  const engagement = (metrics?.likes ?? 0) + (metrics?.retweets ?? 0);
  if (sourceType === "social" && engagement >= 50) {
    importanceScore += 15;
  }
  const confidenceScore =
    sourceType === "publication" || sourceType === "regulatory"
      ? 89
      : sourceType === "social"
        ? 68
        : item.metadata?.rendered
          ? 83
          : sourceType === "news" || sourceType === "press"
            ? 72
            : 76;
  const siteBrand =
    signalType === "competitive_activity"
      ? configCompetitorBrand(source) ?? source.source_name
      : undefined;
  const textBrand = signalType !== "competitive_activity" ? resolveCompetitorBrandFromText(text) : undefined;
  const competitorBrand = siteBrand ?? textBrand;
  const entities: SignalDraft["entities"] = [
    { entityType: "source_name", entityValue: source.source_name },
    ...(signalType === "competitive_activity" && competitorBrand
      ? [{ entityType: "competitor_brand", entityValue: competitorBrand }]
      : []),
    ...(textBrand && signalType !== "competitive_activity"
      ? [{ entityType: "competitor_brand", entityValue: textBrand }]
      : []),
    ...(channel ? [{ entityType: "channel", entityValue: channel }] : []),
    ...(sourceType === "news" || sourceType === "press"
      ? [{ entityType: "ingest_channel", entityValue: sourceType }]
      : []),
    ...(sourceType === "social" ? [{ entityType: "ingest_channel", entityValue: "social" }] : []),
    ...(sourceType === "social" && typeof item.metadata?.author === "string"
      ? [{ entityType: "x_author", entityValue: item.metadata.author }]
      : []),
  ];
  const diseaseState = /mastocytosis|mast cell|tryptase|ms2d2|ism\b|advsm|nonadvsm/i.test(text)
    ? "Systemic Mastocytosis"
    : /\bgist\b|gastrointestinal stromal|pdgfra|imatinib|sunitinib|regorafenib|ripretinib/i.test(text)
      ? "GIST"
      : /oncology|tumor|cancer|biomarker/i.test(text)
        ? "Oncology"
        : undefined;
  return {
    signalType,
    title: item.title,
    summary: item.summary,
    fullText: item.rawContent,
    competitorBrand,
    diseaseState,
    marketRegion: /europe|eu/i.test(text) ? "EU" : "US",
    importanceScore: Math.min(importanceScore, 97),
    confidenceScore,
    entities,
    evidenceLinks: item.url ? [item.url] : [],
  };
}
