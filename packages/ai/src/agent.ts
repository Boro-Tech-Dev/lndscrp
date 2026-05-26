import { getConfig } from "@landscrape/config";
import type {
  AgentToolCall,
  AgentToolSpec,
  ChatMessage,
  RunAgentLoopOptions,
  RunAgentLoopResult,
  RunAgentTurnInput,
  RunAgentTurnResult,
} from "./agentTypes";
import { getAgentInferenceProvider } from "./agentInference";
import type { OllamaUsageMetrics } from "./ollamaUsage";

export type {
  ChatMessage,
  AgentToolSpec,
  AgentToolCall,
  RunAgentTurnInput,
  RunAgentTurnResult,
  RunAgentLoopOptions,
  RunAgentLoopResult,
} from "./agentTypes";

export async function runAgentTurn(input: RunAgentTurnInput): Promise<RunAgentTurnResult> {
  return getAgentInferenceProvider().runTurn(input);
}

export async function runAgentLoop(options: RunAgentLoopOptions): Promise<RunAgentLoopResult> {
  const config = getConfig();
  const maxTurns = options.maxTurns ?? config.agentMaxTurns;
  const maxToolsPerTurn = options.maxToolsPerTurn ?? config.agentMaxToolsPerTurn;
  const messages: ChatMessage[] = [
    { role: "system", content: options.systemPrompt },
    { role: "user", content: options.userMessage },
  ];
  const usages: OllamaUsageMetrics[] = [];
  const citations: string[] = [];

  const ollamaPriority = options.ollamaPriority ?? "user";

  for (let turn = 0; turn < maxTurns; turn++) {
    const result = await runAgentTurn({
      messages,
      tools: options.tools,
      model: options.model,
      ollamaPriority,
    });
    usages.push(result.usage);

    if (result.message.content) {
      messages.push(result.message);
    }

    if (result.done) {
      return {
        finalMessage: result.message.content,
        messages,
        usages,
        citations,
      };
    }

    const calls = result.toolCalls.slice(0, maxToolsPerTurn);
    for (const call of calls) {
      const toolOutput = await options.executeTool(call.name, call.arguments);
      try {
        const parsed = JSON.parse(toolOutput) as { citations?: Array<{ title: string; url?: string }> };
        if (Array.isArray(parsed.citations)) {
          for (const c of parsed.citations) {
            if (c.url) citations.push(c.url);
            else if (c.title) citations.push(c.title);
          }
        }
      } catch {
        /* not json */
      }
      messages.push({
        role: "tool",
        content: toolOutput.slice(0, 12_000),
        tool_name: call.name,
      });
    }

    if (calls.length === 0 && !result.message.content) {
      throw new Error("Agent turn produced tool calls but none were parseable");
    }
  }

  return {
    finalMessage: messages.filter((m) => m.role === "assistant").pop()?.content ?? "Agent reached max turns.",
    messages,
    usages,
    citations,
  };
}
