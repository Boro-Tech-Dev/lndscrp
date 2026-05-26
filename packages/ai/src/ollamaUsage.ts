/** Fields Ollama includes on completed /api/generate and /api/embed responses (names stable in Ollama docs). */
export interface OllamaUsageMetrics {
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalDurationNs: number | null;
}

export function parseOllamaUsageMetrics(
  data: unknown,
  fallbackModel: string
): OllamaUsageMetrics {
  if (!data || typeof data !== "object") {
    return {
      model: fallbackModel,
      promptTokens: null,
      completionTokens: null,
      totalDurationNs: null
    };
  }
  const o = data as Record<string, unknown>;
  const model = typeof o.model === "string" && o.model.length ? o.model : fallbackModel;
  const promptTokens =
    typeof o.prompt_eval_count === "number" && Number.isFinite(o.prompt_eval_count)
      ? o.prompt_eval_count
      : null;
  const completionTokens =
    typeof o.eval_count === "number" && Number.isFinite(o.eval_count) ? o.eval_count : null;
  const totalDurationNs =
    typeof o.total_duration === "number" && Number.isFinite(o.total_duration) ? o.total_duration : null;
  return { model, promptTokens, completionTokens, totalDurationNs };
}
