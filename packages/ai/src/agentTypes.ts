import type { OllamaUsageMetrics } from "./ollamaUsage";
import type { OllamaPriority } from "./ollamaGateway";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_name?: string;
}

export interface AgentToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AgentToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface RunAgentTurnInput {
  messages: ChatMessage[];
  tools: AgentToolSpec[];
  model?: string;
  ollamaPriority?: OllamaPriority;
}

export interface RunAgentTurnResult {
  message: ChatMessage;
  toolCalls: AgentToolCall[];
  usage: OllamaUsageMetrics;
  done: boolean;
}

export interface RunAgentLoopOptions {
  systemPrompt: string;
  userMessage: string;
  tools: AgentToolSpec[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  maxTurns?: number;
  maxToolsPerTurn?: number;
  model?: string;
  ollamaPriority?: OllamaPriority;
}

export interface RunAgentLoopResult {
  finalMessage: string;
  messages: ChatMessage[];
  usages: OllamaUsageMetrics[];
  citations: string[];
}
