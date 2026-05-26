import fetch from "node-fetch";
import { getConfig } from "@landscrape/config";
import type { AgentToolCall, AgentToolSpec, ChatMessage, RunAgentTurnInput, RunAgentTurnResult } from "./agentTypes";
import { parseOllamaUsageMetrics, type OllamaUsageMetrics } from "./ollamaUsage";
import { ollamaFetchInit, withOllamaSlot } from "./ollamaGateway";

export interface AgentInferenceProvider {
  runTurn(input: RunAgentTurnInput): Promise<RunAgentTurnResult>;
}

function toOllamaMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", content: m.content, tool_name: m.tool_name };
    }
    return { role: m.role, content: m.content };
  });
}

function toOpenAiMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        content: m.content,
        tool_call_id: m.tool_name ?? "tool",
      };
    }
    return { role: m.role, content: m.content };
  });
}

function toOpenAiTools(tools: AgentToolSpec[]): Record<string, unknown>[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));
}

export class OllamaAgentProvider implements AgentInferenceProvider {
  async runTurn(input: RunAgentTurnInput): Promise<RunAgentTurnResult> {
    const config = getConfig();
    const model = input.model ?? config.ollamaAgentModel;
    const priority = input.ollamaPriority ?? "user";

    return withOllamaSlot(priority, async () => {
      const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: toOllamaMessages(input.messages),
          tools: input.tools,
        }),
        ...ollamaFetchInit(priority),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Ollama chat ${response.status} for model ${model}: ${body.slice(0, 500)}`);
      }

      const data = (await response.json()) as {
        message?: {
          role?: string;
          content?: string;
          tool_calls?: Array<{ function?: { name?: string; arguments?: Record<string, unknown> } }>;
        };
        model?: string;
        prompt_eval_count?: number;
        eval_count?: number;
        total_duration?: number;
      };

      const msg = data.message;
      const content = typeof msg?.content === "string" ? msg.content.trim() : "";
      const rawCalls = msg?.tool_calls ?? [];
      const toolCalls: AgentToolCall[] = rawCalls
        .map((tc) => {
          const name = tc.function?.name?.trim();
          if (!name) return null;
          const args = tc.function?.arguments ?? {};
          return { name, arguments: typeof args === "object" && args ? args : {} };
        })
        .filter((x): x is AgentToolCall => x !== null);

      const usage = parseOllamaUsageMetrics(data, model);
      const done = toolCalls.length === 0;

      return {
        message: { role: "assistant", content: content || (toolCalls.length ? "" : "No response from model.") },
        toolCalls,
        usage,
        done,
      };
    });
  }
}

export class OpenAiCompatAgentProvider implements AgentInferenceProvider {
  async runTurn(input: RunAgentTurnInput): Promise<RunAgentTurnResult> {
    const config = getConfig();
    const baseUrl = config.openaiCompatBaseUrl?.replace(/\/$/, "");
    const apiKey = config.openaiCompatApiKey;
    const model = input.model ?? config.openaiCompatModel;

    if (!baseUrl || !apiKey || !model) {
      throw new Error(
        "OPENAI_COMPAT_BASE_URL, OPENAI_COMPAT_API_KEY, and OPENAI_COMPAT_MODEL are required when AGENT_INFERENCE_BACKEND=openai_compat"
      );
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: toOpenAiMessages(input.messages),
        tools: input.tools.length > 0 ? toOpenAiTools(input.tools) : undefined,
        tool_choice: input.tools.length > 0 ? "auto" : undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI-compatible chat ${response.status} for model ${model}: ${body.slice(0, 500)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id?: string;
            function?: { name?: string; arguments?: string | Record<string, unknown> };
          }>;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      model?: string;
    };

    const msg = data.choices?.[0]?.message;
    const content = typeof msg?.content === "string" ? msg.content.trim() : "";
    const rawCalls = msg?.tool_calls ?? [];
    const toolCalls: AgentToolCall[] = rawCalls
      .map((tc) => {
        const name = tc.function?.name?.trim();
        if (!name) return null;
        let args: Record<string, unknown> = {};
        const rawArgs = tc.function?.arguments;
        if (typeof rawArgs === "string") {
          try {
            args = JSON.parse(rawArgs) as Record<string, unknown>;
          } catch {
            args = {};
          }
        } else if (rawArgs && typeof rawArgs === "object") {
          args = rawArgs;
        }
        return { name, arguments: args };
      })
      .filter((x): x is AgentToolCall => x !== null);

    const usage: OllamaUsageMetrics = {
      model: data.model ?? model,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalDurationNs: 0,
    };

    return {
      message: { role: "assistant", content: content || (toolCalls.length ? "" : "No response from model.") },
      toolCalls,
      usage,
      done: toolCalls.length === 0,
    };
  }
}

let provider: AgentInferenceProvider | null = null;

export function getAgentInferenceProvider(): AgentInferenceProvider {
  if (!provider) {
    const config = getConfig();
    provider =
      config.agentInferenceBackend === "openai_compat"
        ? new OpenAiCompatAgentProvider()
        : new OllamaAgentProvider();
  }
  return provider;
}

export function resetAgentInferenceProvider(): void {
  provider = null;
}
