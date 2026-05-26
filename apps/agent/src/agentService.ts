import { getConfig } from "@landscrape/config";
import { runAgentLoop, type ChatMessage, type OllamaUsageMetrics } from "@landscrape/ai";
import {
  getRegistryBootstrap,
  hashInput,
  redactInputForAudit,
  PhiPolicyError,
  type ToolRegistry,
} from "@landscrape/intelligence-tools";
import {
  insertMessage,
  recordToolAudit,
  recordOllamaUsage,
} from "./repositories/sessionRepository";
import { listRecentSignals } from "./repositories/signalRepository";

const SYSTEM_PROMPT = `You are LandScrape, a pharmaceutical market intelligence analyst.
You help tenant users research competitive landscape, regulatory updates, clinical trials, and publications.
Rules:
- Never request, store, or process patient-identifiable information (PHI/PII).
- Do not provide clinical advice for individual patients.
- Use tools to cite public sources (PubMed, ClinicalTrials.gov, openFDA, tenant signals, X search via x_search).
- Use x_search only for public professional discourse on X; never include patient-identifiable information from social posts.
- Be concise and executive-ready. Include source citations when tools return them.`;

const EXECUTIVE_BRIEF_SYSTEM_PROMPT = `You are LandScrape, a pharmaceutical market intelligence analyst writing an executive brief.
Produce markdown suitable for a client briefing document.
Rules:
- Never include patient-identifiable information (PHI/PII).
- Do not provide clinical advice for individual patients.
- Ground claims in tenant signals and tool results; cite public sources when tools return them.
- Structure with clear sections: executive summary, key themes, competitor/regulatory highlights, recommended watch items.
- Be concise and executive-ready.`;

const ENRICH_SYSTEM_PROMPT = `You are LandScrape enriching a market intelligence signal with public reference context.
Use tools briefly to add relevant PubMed, ClinicalTrials.gov, or openFDA context.
Return a short structured summary (3-5 sentences) of how public sources relate to the signal.
Do not include PHI/PII or individual patient advice.`;

let registryPromise: ReturnType<typeof getRegistryBootstrap> | null = null;

async function getRegistry(): Promise<ToolRegistry> {
  if (!registryPromise) {
    registryPromise = getRegistryBootstrap().then((boot) => {
      console.log(
        `[agent] reference tools: ${boot.referenceMode}${boot.sidecarCount > 0 ? ` (${boot.sidecarCount} sidecars)` : ""}`
      );
      return boot;
    });
  }
  return (await registryPromise).registry;
}

async function executeToolWithAudit(
  registry: ToolRegistry,
  input: {
    tenantId: string;
    sessionId: string | null;
    mode: "interactive" | "ingest_enrich";
    name: string;
    args: Record<string, unknown>;
  }
): Promise<string> {
  const started = Date.now();
  const tool = registry.resolveByAgentName(input.name);
  const toolId = tool?.id ?? input.name;
  try {
    const toolResult = await registry.executeByAgentName(input.name, input.args, {
      tenantId: input.tenantId,
      mode: input.mode,
    });
    await recordToolAudit({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      toolId,
      inputHash: hashInput(input.args),
      inputRedacted: redactInputForAudit(input.args),
      status: toolResult.ok ? "ok" : "error",
      durationMs: Date.now() - started,
    });
    return JSON.stringify({
      summary: toolResult.summary,
      data: toolResult.data,
      citations: toolResult.citations,
    });
  } catch (err) {
    const denied = err instanceof PhiPolicyError;
    await recordToolAudit({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      toolId,
      inputHash: hashInput(input.args),
      inputRedacted: redactInputForAudit(input.args),
      status: denied ? "denied" : "error",
      durationMs: Date.now() - started,
    });
    throw err;
  }
}

async function recordAgentUsages(
  tenantId: string,
  referenceType: string,
  referenceId: string,
  usages: OllamaUsageMetrics[]
): Promise<void> {
  for (const usage of usages) {
    void recordOllamaUsage({
      tenantId,
      operation: "agent_turn",
      model: usage.model,
      promptTokens: usage.promptTokens ?? 0,
      completionTokens: usage.completionTokens ?? 0,
      totalDurationNs: usage.totalDurationNs ?? 0,
      referenceType,
      referenceId,
    }).catch((e) => console.error("[agent] usage record", e));
  }
}

export interface RunResearchInput {
  tenantId: string;
  sessionId: string;
  userMessage: string;
  mode: "interactive" | "ingest_enrich";
  maxTurns?: number;
  maxToolsPerTurn?: number;
  skipUserMessageInsert?: boolean;
}

export interface RunResearchResult {
  assistantMessage: string;
  citations: string[];
}

export async function runResearchTurn(input: RunResearchInput): Promise<RunResearchResult> {
  const config = getConfig();
  const registry = await getRegistry();
  const toolDefs = registry.toAgentDefinitions();

  if (!input.skipUserMessageInsert) {
    await insertMessage(input.sessionId, "user", input.userMessage);
  }

  const result = await runAgentLoop({
    systemPrompt: input.mode === "ingest_enrich" ? ENRICH_SYSTEM_PROMPT : SYSTEM_PROMPT,
    userMessage: input.userMessage,
    tools: toolDefs,
    maxTurns: input.maxTurns ?? config.agentMaxTurns,
    maxToolsPerTurn: input.maxToolsPerTurn ?? config.agentMaxToolsPerTurn,
    ollamaPriority: input.mode === "ingest_enrich" ? "pipeline" : "user",
    executeTool: async (name, args) =>
      executeToolWithAudit(registry, {
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        mode: input.mode,
        name,
        args,
      }),
  });

  await recordAgentUsages(input.tenantId, "agent_session", input.sessionId, result.usages);

  const citations = [...new Set(result.citations)];
  await insertMessage(input.sessionId, "assistant", result.finalMessage, [], citations);

  return { assistantMessage: result.finalMessage, citations };
}

export async function runOneShotResearch(
  tenantId: string,
  userMessage: string
): Promise<RunResearchResult> {
  const { createSession } = await import("./repositories/sessionRepository");
  const sessionId = await createSession(tenantId, "system", "One-shot research");
  return runResearchTurn({ tenantId, sessionId, userMessage, mode: "interactive" });
}

export async function buildExecutiveBriefWithAgent(
  tenantId: string,
  title: string,
  signalLimit = 5
): Promise<{ bodyMarkdown: string; citations: string[]; signalIds: string[] }> {
  const registry = await getRegistry();
  const signals = await listRecentSignals(tenantId, signalLimit);
  const signalIds = signals.map((s) => s.signal_id);

  const signalBlock = signals
    .map(
      (s, i) =>
        `${i + 1}. [${s.signal_type}] ${s.title} (importance ${s.importance_score})\n   ${s.summary.slice(0, 400)}`
    )
    .join("\n\n");

  const userMessage = [
    `Write an executive brief titled "${title}" based on these recent tenant signals:`,
    "",
    signalBlock || "No recent signals available.",
    "",
    "Use tenant_signals and public reference tools as needed. Output markdown only.",
  ].join("\n");

  const { createSession, insertMessage } = await import("./repositories/sessionRepository");
  const sessionId = await createSession(tenantId, "system", `Brief: ${title}`);
  await insertMessage(sessionId, "user", userMessage);

  const result = await runAgentLoop({
    systemPrompt: EXECUTIVE_BRIEF_SYSTEM_PROMPT,
    userMessage,
    tools: registry.toAgentDefinitions(),
    maxTurns: 6,
    maxToolsPerTurn: 2,
    ollamaPriority: "user",
    executeTool: async (name, args) =>
      executeToolWithAudit(registry, {
        tenantId,
        sessionId,
        mode: "interactive",
        name,
        args,
      }),
  });

  await recordAgentUsages(tenantId, "executive_brief", sessionId, result.usages);
  await insertMessage(sessionId, "assistant", result.finalMessage, [], result.citations);

  const bodyMarkdown = [`# ${title}`, "", result.finalMessage].join("\n");
  return { bodyMarkdown, citations: [...new Set(result.citations)], signalIds };
}

export async function enrichSignalWithAgent(
  tenantId: string,
  signalId: string,
  title: string,
  summary: string
): Promise<{ enrichment: Record<string, unknown>; citations: string[] }> {
  const { createSession } = await import("./repositories/sessionRepository");
  const sessionId = await createSession(tenantId, "system", `Enrich: ${signalId.slice(0, 8)}`);

  const userMessage = [
    "Enrich this market intelligence signal with relevant public reference context:",
    "",
    `Title: ${title}`,
    `Summary: ${summary}`,
    "",
    "Use tools sparingly (PubMed, openFDA, ClinicalTrials.gov). Summarize findings in plain language.",
  ].join("\n");

  const result = await runResearchTurn({
    tenantId,
    sessionId,
    userMessage,
    mode: "ingest_enrich",
    maxTurns: 3,
    maxToolsPerTurn: 2,
  });

  return {
    enrichment: {
      agentSummary: result.assistantMessage,
      enrichedAt: new Date().toISOString(),
      mode: "agent_ingest_enrich",
      signalId,
    },
    citations: result.citations,
  };
}

export type { ChatMessage };
