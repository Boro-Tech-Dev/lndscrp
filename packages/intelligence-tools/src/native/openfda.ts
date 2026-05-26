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

export const nativeOpenFdaSearch: IntelligenceTool = {
  id: "native.openfda.search",
  name: "openfda_search",
  description: "Search openFDA public API (drug enforcement, labels, etc.). L2 public regulatory data only.",
  hipaaLevel: "L2",
  inputSchema: {
    type: "object",
    properties: {
      search: { type: "string", description: "openFDA search query" },
      endpoint: { type: "string", description: "API path e.g. drug/enforcement.json", default: "drug/enforcement.json" },
      limit: { type: "number", default: 10 },
    },
    required: ["search"],
  },
  async execute(input: ToolInput, _ctx: ToolContext): Promise<ToolResult> {
    const search = String(input.search ?? "").trim();
    if (!search) {
      return { ok: false, toolId: "native.openfda.search", summary: "Missing search", error: "search required" };
    }
    const endpoint = String(input.endpoint ?? "drug/enforcement.json").replace(/^\/+/, "");
    const limit = Math.min(20, Math.max(1, Number(input.limit ?? 10)));
    const params = new URLSearchParams();
    params.set("search", search);
    params.set("limit", String(limit));
    const apiKey = getConfig().openfdaApiKey?.trim();
    if (apiKey) params.set("api_key", apiKey);
    const url = `https://api.fda.gov/${endpoint}?${params.toString()}`;
    const res = await fetch(url, { headers: contactHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`openFDA HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { results?: Record<string, unknown>[]; error?: { message?: string } };
    if (json.error?.message) {
      throw new Error(`openFDA: ${json.error.message}`);
    }
    const results = json.results ?? [];
    const items = results.slice(0, limit).map((r, i) => {
      const product = String(r.product_description ?? r.reason_for_recall ?? `Record ${i + 1}`);
      const title = product.slice(0, 200);
      return {
        title,
        recallNumber: r.recall_number,
        status: r.status,
        reason: r.reason_for_recall,
      };
    });
    return {
      ok: true,
      toolId: "native.openfda.search",
      summary: `openFDA returned ${items.length} record(s) for "${search}"`,
      data: { count: items.length, items },
      citations: [{ title: `openFDA search: ${search}`, url: "https://open.fda.gov/", source: "openFDA" }],
    };
  },
};
