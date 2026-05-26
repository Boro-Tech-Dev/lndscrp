export type ToolContextMode = "ingest_enrich" | "interactive";

export interface ToolContext {
  tenantId: string;
  signalId?: string;
  mode: ToolContextMode;
}

export type ToolInput = Record<string, unknown>;

export interface ToolCitation {
  title: string;
  url?: string;
  source?: string;
}

export interface ToolResult {
  ok: boolean;
  toolId: string;
  summary: string;
  data?: unknown;
  citations?: ToolCitation[];
  error?: string;
}

export interface IntelligenceTool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  hipaaLevel: "L2" | "L3";
  execute(input: ToolInput, ctx: ToolContext): Promise<ToolResult>;
}

export interface AgentToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
