import { getConfig } from "@landscrape/config";
import { politeFetchText } from "../politeFetch";
import type { IngestedItem, SourceRow } from "../ingestTypes";
import { buildStableId, normalizePublishedAt, takeWords } from "../ingestUtils";

interface EpmcResult {
  id?: string;
  title?: string;
  authorString?: string;
  journalTitle?: string;
  pubYear?: string;
  firstPublicationDate?: string;
  pmid?: string;
  doi?: string;
  source?: string;
}

interface EpmcSearchResponse {
  resultList?: { result?: EpmcResult[] };
}

export async function fetchEuropePmcItems(source: SourceRow): Promise<IngestedItem[]> {
  const cfg = source.source_config ?? {};
  const query =
    (typeof cfg.epmcQuery === "string" && cfg.epmcQuery.trim()) ||
    (typeof cfg.query === "string" && cfg.query.trim()) ||
    "";
  if (!query) {
    throw new Error(`Europe PMC source '${source.source_name}' requires source_config.epmcQuery or query`);
  }
  const pageSize = Math.min(100, Math.max(1, Number(cfg.pageSize ?? cfg.retmax ?? 25)));
  const params = new URLSearchParams({
    query: query.trim(),
    format: "json",
    pageSize: String(pageSize),
    resultType: "core",
  });
  const email = getConfig().contactEmail;
  if (email) params.set("email", email);
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params.toString()}`;
  const raw = await politeFetchText(url);
  const json = JSON.parse(raw) as EpmcSearchResponse;
  const hits = json.resultList?.result ?? [];
  return hits.map((hit, index) => {
    const title = (hit.title ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!title) {
      throw new Error(`Europe PMC hit ${index + 1} for '${source.source_name}' has no title`);
    }
    const journal = hit.journalTitle ?? hit.source ?? "Europe PMC";
    const authors = hit.authorString ?? "";
    const summary = takeWords([journal, authors, title].filter(Boolean).join(" — "), 50);
    const pmid = hit.pmid;
    const doi = hit.doi;
    const urlOut = pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      : doi
        ? `https://doi.org/${doi}`
        : `https://europepmc.org/article/${hit.id ?? "MED"}`;
    const dateRaw = hit.firstPublicationDate ?? (hit.pubYear ? `${hit.pubYear}-01-01` : null);
    const publishedAt = normalizePublishedAt(dateRaw, source.source_name);
    return {
      externalItemId: buildStableId([hit.id, pmid, doi, title, publishedAt]),
      title,
      summary,
      url: urlOut,
      publishedAt,
      rawContent: JSON.stringify(hit),
      metadata: { provider: "europepmc", pmid, doi, journal },
    } satisfies IngestedItem;
  });
}
