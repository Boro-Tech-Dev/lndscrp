import fetch from "node-fetch";
import { getConfig } from "@landscrape/config";
import { parseOllamaUsageMetrics, type OllamaUsageMetrics } from "./ollamaUsage";
import { ollamaFetchInit, withOllamaSlot, type OllamaPriority } from "./ollamaGateway";

export interface EmbedTextResult {
  embedding: number[];
  usage: OllamaUsageMetrics;
}

export interface EmbedTextOptions {
  priority?: OllamaPriority;
}

async function fetchEmbedding(trimmed: string, priority: OllamaPriority): Promise<EmbedTextResult> {
  const config = getConfig();
  const embedUrl = `${config.ollamaBaseUrl}/api/embed`;
  const legacyUrl = `${config.ollamaBaseUrl}/api/embeddings`;
  const fetchInit = ollamaFetchInit(priority);

  const res = await fetch(embedUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.embeddingModel,
      input: trimmed,
    }),
    ...fetchInit,
  });

  if (res.ok) {
    const data = await res.json();
    const fromBatch = (data as { embeddings?: number[][] }).embeddings?.[0];
    const single = (data as { embedding?: number[] }).embedding;
    const vec = fromBatch?.length ? fromBatch : single;
    if (vec?.length) {
      return {
        embedding: vec,
        usage: parseOllamaUsageMetrics(data, config.embeddingModel),
      };
    }
  }

  const res2 = await fetch(legacyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.embeddingModel,
      prompt: trimmed,
    }),
    ...fetchInit,
  });

  if (!res2.ok) {
    const body = await res2.text().catch(() => "");
    throw new Error(`Ollama embeddings ${res2.status}: ${body}`);
  }
  const legacy = await res2.json();
  const embedding = (legacy as { embedding?: number[] }).embedding;
  if (!embedding?.length) {
    throw new Error("Ollama embeddings returned no vector");
  }
  return {
    embedding,
    usage: parseOllamaUsageMetrics(legacy, config.embeddingModel),
  };
}

export async function embedText(text: string, options?: EmbedTextOptions): Promise<EmbedTextResult> {
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) throw new Error("embedText: empty input");
  const priority = options?.priority ?? "pipeline";
  return withOllamaSlot(priority, () => fetchEmbedding(trimmed, priority));
}
