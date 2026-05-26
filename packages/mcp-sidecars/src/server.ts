import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { searchClinicalTrials, searchOpenFda, searchPubMed } from "./dataSources";

export type SidecarKind = "fda" | "pubmed" | "clinicaltrials";

function toolDefinitions(kind: SidecarKind) {
  if (kind === "fda") {
    return [
      {
        name: "fda_search",
        description: "Search openFDA drug enforcement records (L2 public data)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string" },
            limit: { type: "number" },
          },
          required: ["search"],
        },
      },
    ];
  }
  if (kind === "pubmed") {
    return [
      {
        name: "pubmed_search",
        description: "Search PubMed via NCBI E-utilities (L2 public literature)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            retmax: { type: "number" },
          },
          required: ["query"],
        },
      },
    ];
  }
  return [
    {
      name: "clinicaltrials_search",
      description: "Search ClinicalTrials.gov API v2 (L2 public trials)",
      inputSchema: {
        type: "object",
        properties: {
          condition: { type: "string" },
          intervention: { type: "string" },
          term: { type: "string" },
          pageSize: { type: "number" },
        },
      },
    },
  ];
}

async function runTool(kind: SidecarKind, name: string, args: Record<string, unknown>) {
  if (kind === "fda" && name === "fda_search") {
    const search = String(args.search ?? "");
    const limit = Number(args.limit ?? 10);
    const data = await searchOpenFda(search, limit);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
  if (kind === "pubmed" && name === "pubmed_search") {
    const query = String(args.query ?? "");
    const retmax = Number(args.retmax ?? 5);
    const data = await searchPubMed(query, retmax);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
  if (kind === "clinicaltrials" && name === "clinicaltrials_search") {
    const data = await searchClinicalTrials({
      condition: args.condition ? String(args.condition) : undefined,
      intervention: args.intervention ? String(args.intervention) : undefined,
      term: args.term ? String(args.term) : undefined,
      pageSize: args.pageSize ? Number(args.pageSize) : undefined,
    });
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
  throw new Error(`Unknown tool: ${name}`);
}

function buildServer(kind: SidecarKind): Server {
  const server = new Server({ name: `landscrape-mcp-${kind}`, version: "1.0.0" }, { capabilities: { tools: {} } });
  const tools = toolDefinitions(kind);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    try {
      return await runTool(kind, request.params.name, args);
    } catch (err) {
      return {
        content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      };
    }
  });

  return server;
}

export function startSidecar(kind: SidecarKind, port: number): void {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", sidecar: kind });
  });

  app.post("/mcp", async (req, res) => {
    const server = buildServer(kind);
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
        server.close();
      });
    } catch (err) {
      console.error(`[mcp-${kind}]`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: "MCP handler failed" });
      }
    }
  });

  app.listen(port, () => {
    console.log(`[mcp-${kind}] listening on :${port}`);
  });
}

const kind = (process.env.MCP_SIDECAR_KIND ?? "pubmed") as SidecarKind;
const port = Number(process.env.MCP_SIDECAR_PORT ?? 4020);
startSidecar(kind, port);
