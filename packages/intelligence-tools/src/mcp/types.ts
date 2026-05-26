export interface McpToolResultContent {
  type: string;
  text?: string;
}

export interface McpToolCallResult {
  content?: McpToolResultContent[];
  isError?: boolean;
}

/** Implemented by @landscrape/mcp-client; defined here to avoid circular deps. */
export interface McpToolCaller {
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
}
