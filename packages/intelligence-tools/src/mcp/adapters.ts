import type { McpToolCaller } from "./types";
import type { IntelligenceTool, ToolContext, ToolInput, ToolResult } from "../types";

function mcpTool(
  id: string,
  mcpToolName: string,
  description: string,
  inputSchema: Record<string, unknown>,
  caller: McpToolCaller
): IntelligenceTool {
  return {
    id,
    name: mcpToolName.replace(/\./g, "_"),
    description: `[MCP] ${description}`,
    hipaaLevel: "L2",
    inputSchema,
    async execute(input: ToolInput, ctx: ToolContext): Promise<ToolResult> {
      const raw = await caller.callTool(mcpToolName, input);
      const text =
        raw.content
          ?.map((c) => (c.type === "text" ? c.text : ""))
          .filter(Boolean)
          .join("\n") ?? JSON.stringify(raw);
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* keep text */
      }
      return {
        ok: !raw.isError,
        toolId: id,
        summary: raw.isError ? `MCP error from ${mcpToolName}` : `MCP ${mcpToolName} completed`,
        data: parsed,
        error: raw.isError ? text : undefined,
      };
    },
  };
}

export function createMcpTools(caller: McpToolCaller): IntelligenceTool[] {
  return [
    mcpTool(
      "mcp.fda.search",
      "fda_search",
      "Search openFDA via MCP sidecar",
      {
        type: "object",
        properties: {
          search: { type: "string" },
          limit: { type: "number" },
        },
        required: ["search"],
      },
      caller
    ),
    mcpTool(
      "mcp.pubmed.search",
      "pubmed_search",
      "Search PubMed via MCP sidecar",
      {
        type: "object",
        properties: {
          query: { type: "string" },
          retmax: { type: "number" },
        },
        required: ["query"],
      },
      caller
    ),
    mcpTool(
      "mcp.clinicaltrials.search",
      "clinicaltrials_search",
      "Search ClinicalTrials.gov via MCP sidecar",
      {
        type: "object",
        properties: {
          condition: { type: "string" },
          intervention: { type: "string" },
          term: { type: "string" },
          pageSize: { type: "number" },
        },
      },
      caller
    ),
  ];
}
