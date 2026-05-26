import { getConfig } from "@landscrape/config";
import { politeFetchText } from "../politeFetch";
import type { IngestedItem, SourceRow } from "../ingestTypes";
import { buildStableId, parsePubMedDate, requireString, takeWords } from "../ingestUtils";

function ncbiApiKeyQuery(): string {
  const key = getConfig().ncbiApiKey?.trim();
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

async function fetchEutils(url: string): Promise<string> {
  return politeFetchText(url);
}

/** Optional PubMed abstracts via efetch (XML); merged into item rawContent/metadata when enabled. */
async function fetchAbstractsByPmids(pmids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (pmids.length === 0) return map;
  const keyQ = ncbiApiKeyQuery();
  const chunkSize = 200;
  for (let i = 0; i < pmids.length; i += chunkSize) {
    const chunk = pmids.slice(i, i + chunkSize);
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${chunk.join(",")}${keyQ}`;
    const xml = await fetchEutils(url);
    for (const id of chunk) {
      const block = xml.match(new RegExp(`<PubmedArticle>[\\s\\S]*?<PMID[^>]*>${id}</PMID>[\\s\\S]*?</PubmedArticle>`, "i"));
      if (!block) continue;
      const abstracts = [...block[0].matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi)]
        .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (abstracts.length) map.set(id, abstracts.join(" "));
    }
  }
  return map;
}

export async function fetchPubMedItems(source: SourceRow): Promise<IngestedItem[]> {
  const cfg = source.source_config ?? {};
  const term = String(cfg.query ?? "bezuclastinib OR avapritinib OR ayvakit OR mastocytosis OR GIST");
  const retmax = Number(cfg.retmax ?? 5);
  const includeAbstract = cfg.includeAbstract === true;
  const keyQ = ncbiApiKeyQuery();
  const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=pub+date&retmax=${retmax}&term=${encodeURIComponent(term)}${keyQ}`;
  const esearchText = await fetchEutils(esearchUrl);
  const esearchJson = JSON.parse(esearchText) as { esearchresult?: { idlist?: string[] } };
  const ids = esearchJson.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];
  const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}${keyQ}`;
  const esummaryText = await fetchEutils(esummaryUrl);
  const esummaryJson = JSON.parse(esummaryText) as { result?: Record<string, unknown> };
  let abstracts: Map<string, string> | null = null;
  if (includeAbstract) {
    abstracts = await fetchAbstractsByPmids(ids);
  }
  return ids.map((id) => {
    const record = esummaryJson.result?.[id] as Record<string, unknown> | undefined;
    if (!record) {
      throw new Error(`PubMed esummary missing record for PMID ${id} (source ${source.source_name})`);
    }
    const title = requireString(record.title, `esummary[${id}].title`, source.source_name);
    const authors = Array.isArray(record.authors)
      ? (record.authors as { name?: string }[]).map((a) => a.name).filter(Boolean).join(", ")
      : "";
    const sortPubDate = typeof record.sortpubdate === "string" ? record.sortpubdate.trim() : "";
    const pubDate = typeof record.pubdate === "string" ? record.pubdate.trim() : "";
    if (!sortPubDate && !pubDate) {
      throw new Error(`PubMed record ${id} (source ${source.source_name}) has no pubdate or sortpubdate`);
    }
    const chosenRaw = sortPubDate || pubDate;
    const publishedAt = parsePubMedDate(chosenRaw);
    const journal =
      typeof record.fulljournalname === "string" && record.fulljournalname.trim()
        ? record.fulljournalname.trim()
        : typeof record.source === "string" && record.source.trim()
          ? record.source.trim()
          : "PubMed";
    const summary = takeWords([journal, authors, title].filter(Boolean).join(" — "), 40);
    const url = `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
    const abstractText = abstracts?.get(id);
    const rawPayload = abstractText
      ? JSON.stringify({ esummary: record, abstractText })
      : JSON.stringify(record);
    return {
      externalItemId: buildStableId([id, title, publishedAt]),
      title,
      summary,
      url,
      publishedAt,
      rawContent: rawPayload,
      metadata: {
        pmid: id,
        journal,
        authors,
        rawPubDate: pubDate,
        rawSortPubDate: sortPubDate,
        ...(abstractText ? { hasAbstract: true } : {}),
      },
    } satisfies IngestedItem;
  });
}
