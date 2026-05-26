import fetch from "node-fetch";
import { getConfig } from "@landscrape/config";
import type { ToolContext, ToolInput, ToolResult, IntelligenceTool } from "../types";

function contactHeaders(): Record<string, string> {
  const config = getConfig();
  return {
    "User-Agent": `LandScrape-Intelligence/1.0 (+${config.contactUrl}; mailto:${config.contactEmail})`,
    From: config.contactEmail,
  };
}

export const nativeClinicalTrialsSearch: IntelligenceTool = {
  id: "native.clinicaltrials.search",
  name: "clinicaltrials_search",
  description: "Search ClinicalTrials.gov API v2 for active studies matching condition and/or intervention terms.",
  hipaaLevel: "L2",
  inputSchema: {
    type: "object",
    properties: {
      condition: { type: "string", description: "Condition query (query.cond)" },
      intervention: { type: "string", description: "Intervention query (query.intr)" },
      term: { type: "string", description: "General term (query.term)" },
      pageSize: { type: "number", default: 10 },
    },
  },
  async execute(input: ToolInput, _ctx: ToolContext): Promise<ToolResult> {
    const params = new URLSearchParams();
    params.set("format", "json");
    const pageSize = Math.min(20, Math.max(1, Number(input.pageSize ?? 10)));
    params.set("pageSize", String(pageSize));
    const cond = String(input.condition ?? "").trim();
    const intr = String(input.intervention ?? "").trim();
    const term = String(input.term ?? "").trim();
    if (cond) params.set("query.cond", cond);
    if (intr) params.set("query.intr", intr);
    if (term) params.set("query.term", term);
    if (!cond && !intr && !term) {
      return { ok: false, toolId: "native.clinicaltrials.search", summary: "Missing query", error: "condition, intervention, or term required" };
    }
    const url = `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`;
    const res = await fetch(url, { headers: contactHeaders() });
    if (!res.ok) {
      throw new Error(`ClinicalTrials.gov HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      studies?: Array<{
        protocolSection?: {
          identificationModule?: { nctId?: string; officialTitle?: string; briefTitle?: string };
          descriptionModule?: { briefSummary?: string };
        };
      }>;
    };
    const studies = json.studies ?? [];
    const items = studies.map((s) => {
      const id = s.protocolSection?.identificationModule?.nctId ?? "unknown";
      const title =
        s.protocolSection?.identificationModule?.officialTitle ??
        s.protocolSection?.identificationModule?.briefTitle ??
        id;
      return {
        nctId: id,
        title,
        summary: s.protocolSection?.descriptionModule?.briefSummary?.slice(0, 300) ?? "",
        url: `https://clinicaltrials.gov/study/${id}`,
      };
    });
    const citations = items.map((i) => ({ title: i.title, url: i.url, source: "ClinicalTrials.gov" }));
    return {
      ok: true,
      toolId: "native.clinicaltrials.search",
      summary: `Found ${items.length} trial(s) on ClinicalTrials.gov`,
      data: { count: items.length, items },
      citations,
    };
  },
};
