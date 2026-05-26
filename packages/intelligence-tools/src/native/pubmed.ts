import fetch from "node-fetch";
import { getConfig } from "@landscrape/config";
import type { ToolContext, ToolInput, ToolResult } from "../types";
import type { IntelligenceTool } from "../types";

function contactHeaders(): Record<string, string> {
  const config = getConfig();
  return {
    "User-Agent": `LandScrape-Intelligence/1.0 (+${config.contactUrl}; mailto:${config.contactEmail})`,
    From: config.contactEmail,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: contactHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function ncbiKey(): string {
  const key = getConfig().ncbiApiKey?.trim();
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

export const nativePubmedSearch: IntelligenceTool = {
  id: "native.pubmed.search",
  name: "pubmed_search",
  description: "Search PubMed literature (public NCBI E-utilities). Returns recent article titles and PMIDs.",
  hipaaLevel: "L2",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "PubMed search query" },
      retmax: { type: "number", description: "Max results (1-20)", default: 5 },
    },
    required: ["query"],
  },
  async execute(input: ToolInput, _ctx: ToolContext): Promise<ToolResult> {
    const query = String(input.query ?? "").trim();
    if (!query) {
      return { ok: false, toolId: "native.pubmed.search", summary: "Missing query", error: "query required" };
    }
    const retmax = Math.min(20, Math.max(1, Number(input.retmax ?? 5)));
    const keyQ = ncbiKey();
    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=pub+date&retmax=${retmax}&term=${encodeURIComponent(query)}${keyQ}`;
    const esearch = (await fetchJson(esearchUrl)) as { esearchresult?: { idlist?: string[] } };
    const ids = esearch.esearchresult?.idlist ?? [];
    if (ids.length === 0) {
      return { ok: true, toolId: "native.pubmed.search", summary: `No PubMed hits for "${query}"`, data: { count: 0, items: [] } };
    }
    const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}${keyQ}`;
    const esummary = (await fetchJson(esummaryUrl)) as { result?: Record<string, Record<string, unknown>> };
    const items = ids.map((id) => {
      const rec = esummary.result?.[id];
      const title = typeof rec?.title === "string" ? rec.title : `PMID ${id}`;
      return { pmid: id, title, url: `https://pubmed.ncbi.nlm.nih.gov/${id}/` };
    });
    const citations = items.map((i) => ({ title: i.title, url: i.url, source: "PubMed" }));
    return {
      ok: true,
      toolId: "native.pubmed.search",
      summary: `Found ${items.length} PubMed article(s) for "${query}"`,
      data: { count: items.length, items },
      citations,
    };
  },
};
