export interface McpToolResultContent {
  type: string;
  text?: string;
}

export interface McpToolCallResult {
  content?: McpToolResultContent[];
  isError?: boolean;
}

export interface McpToolCaller {
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
}
