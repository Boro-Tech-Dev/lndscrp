function contactEmail(): string {
  return process.env.LANDSCRAPE_CONTACT_EMAIL?.trim() || "research@landscrape.local";
}

function contactUrl(): string {
  return process.env.LANDSCRAPE_CONTACT_URL?.trim() || "https://landscrape.local";
}

export function contactHeaders(): Record<string, string> {
  return {
    "User-Agent": `LandScrape-MCP/1.0 (+${contactUrl()}; mailto:${contactEmail()})`,
    From: contactEmail(),
  };
}

export async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: contactHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

export function ncbiKeyQuery(): string {
  const key = process.env.NCBI_API_KEY?.trim();
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

export async function searchPubMed(query: string, retmax: number): Promise<unknown> {
  const keyQ = ncbiKeyQuery();
  const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=pub+date&retmax=${retmax}&term=${encodeURIComponent(query)}${keyQ}`;
  const esearch = (await fetchJson(esearchUrl)) as { esearchresult?: { idlist?: string[] } };
  const ids = esearch.esearchresult?.idlist ?? [];
  if (ids.length === 0) return { count: 0, items: [] };
  const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}${keyQ}`;
  const esummary = (await fetchJson(esummaryUrl)) as { result?: Record<string, Record<string, unknown>> };
  const items = ids.map((id) => {
    const rec = esummary.result?.[id];
    const title = typeof rec?.title === "string" ? rec.title : `PMID ${id}`;
    return { pmid: id, title, url: `https://pubmed.ncbi.nlm.nih.gov/${id}/` };
  });
  return { count: items.length, items };
}

export async function searchClinicalTrials(args: {
  condition?: string;
  intervention?: string;
  term?: string;
  pageSize?: number;
}): Promise<unknown> {
  const params = new URLSearchParams();
  params.set("format", "json");
  params.set("pageSize", String(Math.min(20, Math.max(1, args.pageSize ?? 10))));
  if (args.condition) params.set("query.cond", args.condition);
  if (args.intervention) params.set("query.intr", args.intervention);
  if (args.term) params.set("query.term", args.term);
  const url = `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`;
  const json = (await fetchJson(url)) as {
    studies?: Array<{
      protocolSection?: {
        identificationModule?: { nctId?: string; officialTitle?: string; briefTitle?: string };
      };
    }>;
  };
  const items = (json.studies ?? []).map((s) => {
    const id = s.protocolSection?.identificationModule?.nctId ?? "unknown";
    const title =
      s.protocolSection?.identificationModule?.officialTitle ??
      s.protocolSection?.identificationModule?.briefTitle ??
      id;
    return { nctId: id, title, url: `https://clinicaltrials.gov/study/${id}` };
  });
  return { count: items.length, items };
}

export async function searchOpenFda(search: string, limit: number): Promise<unknown> {
  const params = new URLSearchParams();
  params.set("search", search);
  params.set("limit", String(Math.min(20, Math.max(1, limit))));
  const apiKey = process.env.OPENFDA_API_KEY?.trim();
  if (apiKey) params.set("api_key", apiKey);
  const url = `https://api.fda.gov/drug/enforcement.json?${params.toString()}`;
  const json = (await fetchJson(url)) as { results?: Record<string, unknown>[] };
  const items = (json.results ?? []).slice(0, limit).map((r) => ({
    product: r.product_description,
    reason: r.reason_for_recall,
    status: r.status,
    recallNumber: r.recall_number,
  }));
  return { count: items.length, items };
}
