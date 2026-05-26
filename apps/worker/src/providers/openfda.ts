import { politeFetch } from "../politeFetch";
import type { IngestedItem, SourceRow } from "../ingestTypes";
import { buildStableId, takeWords } from "../ingestUtils";

function asString(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

/** Build openFDA API URL from source_config or use base_url. */
export function buildOpenFdaUrl(source: SourceRow): string {
  const cfg = source.source_config ?? {};
  if (source.base_url?.trim()) {
    const u = source.base_url.trim();
    if (u.includes("api.fda.gov")) return u;
  }
  const endpoint = asString(cfg.openfdaEndpoint).trim() || "drug/enforcement.json";
  const path = endpoint.replace(/^\/+/, "");
  const search = asString(cfg.openfdaSearch).trim();
  const limit = Math.min(100, Math.max(1, Number(cfg.openfdaLimit ?? cfg.maxItems ?? 20)));
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", String(limit));
  const apiKey = asString(cfg.openfdaApiKey).trim() || process.env.OPENFDA_API_KEY?.trim();
  if (apiKey) params.set("api_key", apiKey);
  return `https://api.fda.gov/${path}?${params.toString()}`;
}

function openfdaTitle(record: Record<string, unknown>): string {
  const recall = asString(record.recalling_firm).trim();
  const product = asString(record.product_description).trim();
  const classification = asString(record.classification).trim();
  const id = asString(record.recall_number || record.report_number || record.id);
  if (product) return product.slice(0, 500);
  if (recall && classification) return `${recall} — ${classification}`.slice(0, 500);
  if (recall) return recall.slice(0, 500);
  if (id) return `FDA record ${id}`;
  return "openFDA item";
}

function openfdaSummary(record: Record<string, unknown>): string {
  const reason = asString(record.reason_for_recall).trim();
  const status = asString(record.status).trim();
  const country = asString(record.country).trim();
  const bits = [reason, status, country].filter(Boolean);
  const joined = bits.join(" — ");
  return takeWords(joined || openfdaTitle(record), 70);
}

function openfdaDate(record: Record<string, unknown>): string | null {
  const d =
    asString(record.recall_initiation_date).trim() ||
    asString(record.report_date).trim() ||
    asString(record.date).trim();
  return d || null;
}

function openfdaUrl(record: Record<string, unknown>, fallback: string): string | null {
  const u = asString(record.more_code_info || record.url).trim();
  if (u && /^https?:\/\//i.test(u)) return u;
  return fallback.startsWith("http") ? fallback : null;
}

export function isOpenFdaNotFound(body: string): boolean {
  try {
    const json = JSON.parse(body) as { error?: { code?: string } };
    return json.error?.code === "NOT_FOUND";
  } catch {
    return false;
  }
}

export function parseOpenFdaResponse(
  status: number,
  statusText: string,
  url: string,
  raw: string,
  source: SourceRow
): IngestedItem[] {
  if (status === 404 && isOpenFdaNotFound(raw)) {
    return [];
  }

  if (status < 200 || status >= 300) {
    throw new Error(`politeFetchText: ${status} ${statusText} for ${url}: ${raw.slice(0, 500)}`);
  }

  const json = JSON.parse(raw) as { results?: Record<string, unknown>[]; error?: { message?: string; code?: string } };
  if (json.error?.message) {
    throw new Error(`openFDA error for '${source.source_name}': ${json.error.message}`);
  }
  const items = Array.isArray(json.results) ? json.results : [];
  const maxItems = Math.min(100, Math.max(1, Number(source.source_config?.maxItems ?? 20)));
  return mapOpenFdaResults(items.slice(0, maxItems), source, url);
}

function mapOpenFdaResults(
  items: Record<string, unknown>[],
  source: SourceRow,
  url: string
): IngestedItem[] {
  return items.map((item, index) => {
    const title = openfdaTitle(item);
    const summary = openfdaSummary(item);
    if (!summary.trim()) {
      throw new Error(`openFDA item ${index + 1} for '${source.source_name}' produced empty summary`);
    }
    const publishedAt = openfdaDate(item);
    return {
      externalItemId: buildStableId([
        asString(item.recall_number || item.report_number || item.id),
        title,
        publishedAt,
        `${index}`,
      ]),
      title,
      summary,
      url: openfdaUrl(item, url),
      publishedAt,
      rawContent: JSON.stringify(item),
      metadata: { format: "openfda", provider: "openfda" },
    } satisfies IngestedItem;
  });
}

export async function fetchOpenFdaItems(source: SourceRow): Promise<IngestedItem[]> {
  const url = buildOpenFdaUrl(source);
  const response = await politeFetch(url);
  const raw = await response.text();
  return parseOpenFdaResponse(response.status, response.statusText, url, raw, source);
}
