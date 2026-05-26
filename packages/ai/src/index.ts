import fetch from "node-fetch";
import { getConfig } from "@landscrape/config";
import { parseOllamaUsageMetrics, type OllamaUsageMetrics } from "./ollamaUsage";
import { ollamaFetchInit, withOllamaSlot, type OllamaPriority } from "./ollamaGateway";

export { embedText } from "./embeddings";
export type { EmbedTextResult, EmbedTextOptions } from "./embeddings";
export type { OllamaUsageMetrics } from "./ollamaUsage";
export type { OllamaPriority } from "./ollamaGateway";
export { withOllamaSlot } from "./ollamaGateway";
export { runAgentTurn, runAgentLoop } from "./agent";
export type {
  ChatMessage,
  AgentToolSpec,
  AgentToolCall,
  RunAgentTurnInput,
  RunAgentTurnResult,
  RunAgentLoopOptions,
  RunAgentLoopResult,
} from "./agentTypes";

export interface ModelSummaryInput {
  title: string;
  summary: string;
  signalType: string;
}

export interface GenerateSummaryOptions {
  priority?: OllamaPriority;
}

export interface GenerateSummaryResult {
  summary: string;
  usage: OllamaUsageMetrics;
}

const DEFAULT_SUMMARY_PROMPT_MAX_CHARS = 2500;

/** Bounds prompt body size before Ollama (context window / VPS memory). */
export function truncateForSummary(text: string, maxChars = DEFAULT_SUMMARY_PROMPT_MAX_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}…`;
}

export async function generateSummary(
  input: ModelSummaryInput,
  options?: GenerateSummaryOptions
): Promise<GenerateSummaryResult> {
  const config = getConfig();
  const priority = options?.priority ?? "pipeline";

  const sourceSummary = truncateForSummary(input.summary);

  return withOllamaSlot(priority, async () => {
    const response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        stream: false,
        prompt: [
          "You are LandScrape, a market intelligence analyst.",
          "Produce a concise executive-ready intelligence note with 2 sentences max.",
          `Signal Type: ${input.signalType}`,
          `Title: ${input.title}`,
          `Source Summary: ${sourceSummary}`,
        ].join("\n"),
      }),
      ...ollamaFetchInit(priority),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "<unreadable body>");
      throw new Error(
        `Ollama ${response.status} ${response.statusText} for model ${config.ollamaModel} at ${config.ollamaBaseUrl}: ${body}`
      );
    }

    const data = await response.json();
    const trimmed =
      typeof (data as { response?: string }).response === "string"
        ? (data as { response: string }).response.trim()
        : "";
    if (!trimmed) {
      throw new Error(`Ollama returned empty response for model ${config.ollamaModel}; title="${input.title}"`);
    }
    return {
      summary: trimmed,
      usage: parseOllamaUsageMetrics(data, config.ollamaModel),
    };
  });
}
