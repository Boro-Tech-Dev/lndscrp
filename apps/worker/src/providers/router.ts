import type { IngestedItem, SourceRow } from "../ingestTypes";
import {
  fetchCompetitorSiteItems,
  fetchCongressLegacyItems,
  fetchPayerLegacyItems,
  fetchRegulatoryLegacyItems,
  shouldUseRenderedMode,
} from "../adaptersCore";
import { buildRenderedItems, renderPage, userAgentForRenderer } from "../renderedPage";
import { asNumber, normalizeHtmlContent, takeWords } from "../ingestUtils";
import { politeFetchText } from "../politeFetch";
import { parseRssFeed } from "./rss";
import { fetchPubMedItems } from "./pubmed";
import { fetchEuropePmcItems } from "./europepmc";
import { fetchClinicalTrialsGovItems } from "./clinicalTrials";
import { fetchOpenFdaItems } from "./openfda";
import { buildStableId } from "../ingestUtils";

function hasClinicalTrialsQueryConfig(cfg: Record<string, unknown> | null | undefined): boolean {
  if (!cfg) return false;
  return Boolean(
    cfg["query.cond"] ||
      cfg["query.term"] ||
      cfg["query.intr"] ||
      cfg["query.titles"] ||
      cfg["query.locn"] ||
      cfg.condition ||
      cfg.intervention
  );
}

function providerId(source: SourceRow): string {
  const cfg = source.source_config ?? {};
  return typeof cfg.provider === "string" ? cfg.provider.trim().toLowerCase() : "";
}

async function fetchGenericFromUrl(source: SourceRow): Promise<IngestedItem[]> {
  if (!source.base_url) return [];
  if (shouldUseRenderedMode(source)) {
    const rendered = await renderPage(source.base_url, source.source_config ?? {}, userAgentForRenderer());
    const mode = source.source_type === "press" ? "press_rendered" : "news_rendered";
    return buildRenderedItems(source, rendered, mode);
  }
  const raw = await politeFetchText(source.base_url);
  const cfg = source.source_config ?? {};
  if (raw.includes("<item") || raw.includes("<entry")) {
    const maxItems = asNumber(cfg.maxItems ?? cfg.rssMaxItems, 50);
    return parseRssFeed(raw, {
      maxItems,
      dedupeByGuid: cfg.rssDedupe !== false,
      sourceName: source.source_name,
    });
  }
  const parsed = normalizeHtmlContent(raw);
  if (!parsed.title) {
    throw new Error(`Generic HTML page for '${source.source_name}' (${source.base_url}) has no <title>`);
  }
  return [
    {
      externalItemId: buildStableId([source.base_url, parsed.title, parsed.summary]),
      title: parsed.title,
      summary: takeWords(parsed.summary, 70),
      url: source.base_url,
      publishedAt: null,
      rawContent: parsed.content,
      metadata: { format: "generic" },
    },
  ];
}

export async function routeIngestion(source: SourceRow): Promise<IngestedItem[]> {
  const pid = providerId(source);
  switch (source.source_type) {
    case "publication":
      if (pid === "europepmc") return fetchEuropePmcItems(source);
      return fetchPubMedItems(source);
    case "competitor_site":
      return fetchCompetitorSiteItems(source);
    case "congress":
      if (pid === "clinicaltrials_v2" || (!source.base_url?.trim() && hasClinicalTrialsQueryConfig(source.source_config))) {
        return fetchClinicalTrialsGovItems(source);
      }
      return fetchCongressLegacyItems(source);
    case "regulatory":
      if (pid === "openfda") return fetchOpenFdaItems(source);
      return fetchRegulatoryLegacyItems(source);
    case "payer":
      return fetchPayerLegacyItems(source);
    case "news":
    case "press":
      return fetchGenericFromUrl(source);
    default:
      return fetchGenericFromUrl(source);
  }
}
