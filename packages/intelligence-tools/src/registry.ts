import type { IntelligenceTool, AgentToolDefinition, ToolContext, ToolInput, ToolResult } from "./types";
import { assertToolAllowed, assertInputSafe } from "./phiPolicy";
import { nativePubmedSearch } from "./native/pubmed";
import { nativeClinicalTrialsSearch } from "./native/clinicaltrials";
import { nativeOpenFdaSearch } from "./native/openfda";
import { nativeTenantSignals } from "./native/tenantSignals";
import { nativeXProfile } from "./native/xProfile";
import { nativeXSearch } from "./native/xSearch";
import { createMcpTools } from "./mcp/adapters";
import type { McpToolCaller } from "./mcp/types";

export type ReferenceToolsMode = "mcp" | "native";

export interface CreateRegistryOptions {
  mode?: ReferenceToolsMode;
  mcpCallers?: McpToolCaller[];
}

export class ToolRegistry {
  private tools = new Map<string, IntelligenceTool>();

  register(tool: IntelligenceTool): void {
    assertToolAllowed(tool.id);
    this.tools.set(tool.id, tool);
  }

  registerNativeDefaults(): void {
    this.registerNativeClinical();
    this.register(nativeTenantSignals);
  }

  registerNativeClinical(): void {
    for (const t of [nativePubmedSearch, nativeClinicalTrialsSearch, nativeOpenFdaSearch, nativeXSearch, nativeXProfile]) {
      this.register(t);
    }
  }

  registerMcpSidecars(callers: McpToolCaller[]): void {
    for (const caller of callers) {
      for (const tool of createMcpTools(caller)) {
        this.register(tool);
      }
    }
  }

  list(): IntelligenceTool[] {
    return [...this.tools.values()];
  }

  get(id: string): IntelligenceTool | undefined {
    return this.tools.get(id);
  }

  toAgentDefinitions(): AgentToolDefinition[] {
    return this.list().map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  resolveByAgentName(name: string): IntelligenceTool | undefined {
    return this.list().find((t) => t.name === name);
  }

  async execute(toolId: string, input: ToolInput, ctx: ToolContext): Promise<ToolResult> {
    assertToolAllowed(toolId);
    assertInputSafe(input, toolId);
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { ok: false, toolId, summary: "Tool not registered", error: `Unknown tool: ${toolId}` };
    }
    return tool.execute(input, ctx);
  }

  async executeByAgentName(name: string, input: ToolInput, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.resolveByAgentName(name);
    if (!tool) {
      return { ok: false, toolId: name, summary: "Unknown agent tool", error: `Unknown tool name: ${name}` };
    }
    return this.execute(tool.id, input, ctx);
  }
}

export function createDefaultRegistry(options: CreateRegistryOptions = {}): ToolRegistry {
  const mode = options.mode ?? "native";
  const callers = options.mcpCallers ?? [];
  const registry = new ToolRegistry();
  registry.register(nativeTenantSignals);
  registry.register(nativeXSearch);
  registry.register(nativeXProfile);
  if (mode === "mcp" && callers.length > 0) {
    registry.registerMcpSidecars(callers);
  } else {
    registry.registerNativeClinical();
  }
  return registry;
}
