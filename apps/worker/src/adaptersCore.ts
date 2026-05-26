import { getConfig } from "@landscrape/config";
import type { IngestedItem, SourceRow } from "./ingestTypes";
import {
  asNumber,
  buildStableId,
  normalizeHtmlContent,
  requireString,
  stripTags,
  takeWords,
} from "./ingestUtils";
import { politeFetchText } from "./politeFetch";
import { buildRenderedItems, renderPage, userAgentForRenderer } from "./renderedPage";

async function fetchText(url: string, init?: { headers?: Record<string, string> }): Promise<string> {
  return politeFetchText(url, { headers: init?.headers });
}

export function shouldUseRenderedMode(source: SourceRow): boolean {
  const cfg = source.source_config ?? {};
  if (cfg.rendered === true) return true;
  if (source.source_type === "competitor_site") {
    return getConfig().competitorRenderMode === "playwright";
  }
  if (source.source_type === "congress" && cfg.renderMode === "playwright") return true;
  return false;
}

export async function fetchCompetitorSiteItems(source: SourceRow): Promise<IngestedItem[]> {
  if (!source.base_url) throw new Error(`Source ${source.source_name} missing base_url`);
  if (shouldUseRenderedMode(source)) {
    const rendered = await renderPage(source.base_url, source.source_config ?? {}, userAgentForRenderer());
    return buildRenderedItems(source, rendered, "competitor_rendered");
  }
  const html = await fetchText(source.base_url);
  const parsed = normalizeHtmlContent(html);
  if (!parsed.title) {
    throw new Error(`Competitor site ${source.source_name} (${source.base_url}) has no <title>`);
  }
  return [
    {
      externalItemId: buildStableId([source.base_url, parsed.title, parsed.summary, parsed.content.slice(0, 4000)]),
      title: parsed.title,
      summary: takeWords(parsed.summary, 70),
      url: source.base_url,
      publishedAt: null,
      rawContent: parsed.content,
      metadata: { mode: "site_snapshot", rendered: false },
    },
  ];
}

interface ClinicalTrialsStudy {
  protocolSection?: {
    identificationModule?: { officialTitle?: string; briefTitle?: string; nctId?: string };
    statusModule?: { lastUpdatePostDateStruct?: { date?: string }; startDateStruct?: { date?: string } };
    descriptionModule?: { briefSummary?: string };
    conditionsModule?: { conditions?: string[] };
  };
}

function parseClinicalTrialsStudies(json: { studies?: ClinicalTrialsStudy[] }, source: SourceRow): IngestedItem[] {
  const studies: ClinicalTrialsStudy[] = Array.isArray(json?.studies) ? json.studies : [];
  return studies.map((study, index) => {
    const id = study.protocolSection?.identificationModule?.nctId;
    if (!id) {
      throw new Error(`ClinicalTrials.gov study ${index + 1} for source '${source.source_name}' missing nctId`);
    }
    const officialTitle = study.protocolSection?.identificationModule?.officialTitle;
    const briefTitle = study.protocolSection?.identificationModule?.briefTitle;
    const title = (officialTitle ?? briefTitle ?? "").trim();
    if (!title) {
      throw new Error(`ClinicalTrials.gov study ${id} for source '${source.source_name}' has no officialTitle or briefTitle`);
    }
    const lastUpdate = study.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date;
    const startDate = study.protocolSection?.statusModule?.startDateStruct?.date;
    const chosen = (lastUpdate ?? startDate ?? "").trim();
    if (!chosen) {
      throw new Error(`ClinicalTrials.gov study ${id} for source '${source.source_name}' has no lastUpdatePostDate or startDate`);
    }
    const summary = takeWords(study.protocolSection?.descriptionModule?.briefSummary ?? title, 60);
    const url = `https://clinicaltrials.gov/study/${id}`;
    return {
      externalItemId: id,
      title,
      summary,
      url,
      publishedAt: chosen,
      rawContent: JSON.stringify(study.protocolSection ?? {}),
      metadata: {
        format: "clinicaltrials_json",
        nctId: id,
        conditions: study.protocolSection?.conditionsModule?.conditions ?? [],
      },
    } satisfies IngestedItem;
  });
}

export async function fetchCongressLegacyItems(source: SourceRow): Promise<IngestedItem[]> {
  if (!source.base_url) throw new Error(`Source ${source.source_name} missing base_url`);
  if (shouldUseRenderedMode(source)) {
    const rendered = await renderPage(source.base_url, source.source_config ?? {}, userAgentForRenderer());
    return buildRenderedItems(source, rendered, "congress_rendered").slice(0, asNumber(source.source_config?.maxItems, 12));
  }
  const raw = await fetchText(source.base_url);
  const cfg = source.source_config ?? {};
  const format = String(cfg.format ?? (raw.trim().startsWith("<") ? "xml" : "json"));
  if (format === "json") {
    const json = JSON.parse(raw) as { studies?: ClinicalTrialsStudy[]; items?: unknown[]; sessions?: unknown[] };
    if (Array.isArray(json?.studies)) {
      return parseClinicalTrialsStudies(json, source).slice(0, asNumber(cfg.maxItems, 20));
    }
    const items = (Array.isArray(json.items) ? json.items : Array.isArray(json.sessions) ? json.sessions : []) as Record<
      string,
      unknown
    >[];
    return items.slice(0, 12).map((item, index: number) => {
      const title = requireString(
        (item.title ?? item.session) as string | undefined,
        `json.items[${index}].title`,
        source.source_name
      );
      const summary = takeWords(String(item.abstract ?? item.description ?? item.summary ?? item.track ?? ""), 70);
      if (!summary) {
        throw new Error(`Congress JSON item ${index + 1} for '${source.source_name}' has no abstract/description/summary/track`);
      }
      return {
        externalItemId: buildStableId([
          String(item.id ?? ""),
          title,
          item.start != null ? String(item.start) : null,
          item.url != null ? String(item.url) : null,
          `${index}`,
        ]),
        title,
        summary,
        url: typeof item.url === "string" ? item.url : source.base_url,
        publishedAt:
          item.start != null
            ? String(item.start)
            : item.date != null
              ? String(item.date)
              : null,
        rawContent: JSON.stringify(item),
        metadata: { format: "json", rendered: false },
      } satisfies IngestedItem;
    });
  }
  const { parseRssFeed } = await import("./providers/rss");
  if (raw.includes("<item") || raw.includes("<entry")) {
    const maxRss = asNumber(cfg.maxItems ?? cfg.rssMaxItems, 50);
    return parseRssFeed(raw, { maxItems: maxRss, dedupeByGuid: cfg.rssDedupe !== false, sourceName: source.source_name }).map(
      (item) => ({ ...item, metadata: { ...(item.metadata ?? {}), rendered: false } })
    );
  }
  const blocks = [...raw.matchAll(/<(article|section|li)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => stripTags(m[2]))
    .filter((text) => text.length > 80)
    .slice(0, 12);
  if (blocks.length === 0) {
    throw new Error(`Congress HTML fallback for '${source.source_name}' produced zero blocks from ${source.base_url}`);
  }
  return blocks.map((block, index) => ({
    externalItemId: buildStableId([source.base_url, `${index}`, block.slice(0, 300)]),
    title: takeWords(block, 10),
    summary: takeWords(block, 70),
    url: source.base_url,
    publishedAt: null,
    rawContent: block,
    metadata: { format: "html", rendered: false },
  }));
}

export async function fetchRegulatoryLegacyItems(source: SourceRow): Promise<IngestedItem[]> {
  if (!source.base_url) throw new Error(`Source ${source.source_name} missing base_url`);
  const raw = await fetchText(source.base_url);
  const cfg = source.source_config ?? {};
  if (raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
    const json = JSON.parse(raw) as { results?: unknown[]; items?: unknown[] };
    const items = (
      Array.isArray(json.results) ? json.results : Array.isArray(json.items) ? json.items : Array.isArray(json) ? json : []
    ) as Record<string, unknown>[];
    const cap = asNumber(cfg.maxItems, 50);
    return items.slice(0, cap).map((item, index: number) => {
      const title = requireString(
        (item.title ?? item.product_description) as string | undefined,
        `regulatory.items[${index}].title`,
        source.source_name
      );
      const summary = takeWords(String(item.summary ?? item.reason_for_recall ?? item.description ?? item.classification ?? ""), 70);
      if (!summary) {
        throw new Error(`Regulatory JSON item ${index + 1} for '${source.source_name}' has no summary/description/classification`);
      }
      return {
        externalItemId: buildStableId([
          String(item.id ?? ""),
          title,
          item.date != null ? String(item.date) : null,
          item.url != null ? String(item.url) : null,
          `${index}`,
        ]),
        title,
        summary,
        url:
          typeof item.url === "string"
            ? item.url
            : typeof item.more_code_info === "string"
              ? item.more_code_info
              : source.base_url,
        publishedAt:
          item.date != null ? String(item.date) : item.report_date != null ? String(item.report_date) : null,
        rawContent: JSON.stringify(item),
        metadata: { format: "json" },
      } satisfies IngestedItem;
    });
  }
  const { parseRssFeed } = await import("./providers/rss");
  if (raw.includes("<item") || raw.includes("<entry")) {
    const maxRss = asNumber(cfg.maxItems ?? cfg.rssMaxItems, 50);
    return parseRssFeed(raw, { maxItems: maxRss, dedupeByGuid: cfg.rssDedupe !== false, sourceName: source.source_name });
  }
  const parsed = normalizeHtmlContent(raw);
  if (!parsed.title) {
    throw new Error(`Regulatory HTML page for '${source.source_name}' (${source.base_url}) has no <title>`);
  }
  return [
    {
      externalItemId: buildStableId([source.base_url, parsed.title, parsed.summary]),
      title: parsed.title,
      summary: takeWords(parsed.summary, 70),
      url: source.base_url,
      publishedAt: null,
      rawContent: parsed.content,
      metadata: { format: "html" },
    },
  ];
}

export async function fetchPayerLegacyItems(source: SourceRow): Promise<IngestedItem[]> {
  if (!source.base_url) throw new Error(`Source ${source.source_name} missing base_url`);
  const raw = await fetchText(source.base_url);
  const cfg = source.source_config ?? {};
  const { parseRssFeed } = await import("./providers/rss");
  if (raw.includes("<item") || raw.includes("<entry")) {
    const maxRss = asNumber(cfg.maxItems ?? cfg.rssMaxItems, 50);
    return parseRssFeed(raw, { maxItems: maxRss, dedupeByGuid: cfg.rssDedupe !== false, sourceName: source.source_name });
  }
  const parsed = normalizeHtmlContent(raw);
  if (!parsed.title) {
    throw new Error(`Payer HTML page for '${source.source_name}' (${source.base_url}) has no <title>`);
  }
  const keywordSnippets = parsed.content
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) =>
      /(formulary|coverage|reimbursement|policy|prior authorization|medical benefit|pharmacy benefit)/i.test(sentence)
    )
    .slice(0, 10);
  const blocks = keywordSnippets.length > 0 ? keywordSnippets : [parsed.summary];
  return blocks.map((block, index) => ({
    externalItemId: buildStableId([source.base_url, `${index}`, block.slice(0, 300)]),
    title: `${source.source_name} policy update ${index + 1}`,
    summary: takeWords(block, 70),
    url: source.base_url,
    publishedAt: null,
    rawContent: block,
    metadata: { format: "html" },
  }));
}
