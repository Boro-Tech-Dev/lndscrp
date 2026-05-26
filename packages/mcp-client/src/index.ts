import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpToolCallResult, McpToolCaller } from "./types";

export type { McpToolCaller, McpToolCallResult };

const DEFAULT_TIMEOUT_MS = 30_000;

export interface McpSidecarClientOptions {
  name: string;
  baseUrl: string;
  timeoutMs?: number;
}

export class McpSidecarClient implements McpToolCaller {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private toolsCache: { name: string; description?: string }[] | null = null;
  private readonly timeoutMs: number;

  constructor(private readonly options: McpSidecarClientOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private mcpUrl(): URL {
    const base = this.options.baseUrl.replace(/\/$/, "");
    return new URL(`${base}/mcp`);
  }

  async connect(): Promise<void> {
    if (this.client) return;
    this.transport = new StreamableHTTPClientTransport(this.mcpUrl());
    this.client = new Client({ name: `landscrape-${this.options.name}`, version: "1.0.0" });
    await this.withTimeout(this.client.connect(this.transport), "connect");
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
    this.client = null;
    this.transport = null;
    this.toolsCache = null;
  }

  async listTools(): Promise<{ name: string; description?: string }[]> {
    await this.connect();
    if (this.toolsCache) return this.toolsCache;
    const result = await this.withTimeout(this.client!.listTools(), "listTools");
    this.toolsCache = result.tools.map((t) => ({ name: t.name, description: t.description }));
    return this.toolsCache;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    await this.connect();
    const result = await this.withTimeout(this.client!.callTool({ name, arguments: args }), `callTool:${name}`);
    const content = Array.isArray(result.content)
      ? result.content.map((c) => ({
          type: c.type,
          text: "text" in c && typeof c.text === "string" ? c.text : JSON.stringify(c),
        }))
      : [];
    return {
      content,
      isError: Boolean(result.isError),
    };
  }

  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`MCP ${this.options.name} ${label} timed out after ${this.timeoutMs}ms`)),
            this.timeoutMs
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export class McpClientPool {
  private clients = new Map<string, McpSidecarClient>();

  getOrCreate(key: string, options: McpSidecarClientOptions): McpSidecarClient {
    let client = this.clients.get(key);
    if (!client) {
      client = new McpSidecarClient(options);
      this.clients.set(key, client);
    }
    return client;
  }

  async connectAll(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.connect()));
  }

  async disconnectAll(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.disconnect()));
    this.clients.clear();
  }

  callers(): McpSidecarClient[] {
    return [...this.clients.values()];
  }
}

export function createClinicalReferenceKitPool(urls: {
  fda?: string;
  pubmed?: string;
  clinicaltrials?: string;
}): McpClientPool {
  const pool = new McpClientPool();
  if (urls.fda?.trim()) {
    pool.getOrCreate("fda", { name: "fda", baseUrl: urls.fda.trim() });
  }
  if (urls.pubmed?.trim()) {
    pool.getOrCreate("pubmed", { name: "pubmed", baseUrl: urls.pubmed.trim() });
  }
  if (urls.clinicaltrials?.trim()) {
    pool.getOrCreate("clinicaltrials", { name: "clinicaltrials", baseUrl: urls.clinicaltrials.trim() });
  }
  return pool;
}
