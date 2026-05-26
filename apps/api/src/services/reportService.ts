import { randomUUID } from "crypto";
import { getConfig } from "@landscrape/config";
import { generateSummary } from "@landscrape/ai";
import { recordOllamaUsage } from "@landscrape/db";
import { createQueue, enqueueDefaultReportExports, userJobOptions } from "@landscrape/jobs";
import type { AgentBriefPayload } from "@landscrape/jobs";
import { listSignalsByTenant, createReportFromSignals } from "../repositories/signalRepository";
import { createBriefJob } from "../repositories/briefJobRepository";

async function fetchAgentExecutiveBrief(
  tenantId: string,
  title: string,
  signalLimit: number
): Promise<{ bodyMarkdown: string; citations: string[]; signalIds: string[] }> {
  const config = getConfig();
  const url = `${config.agentInternalUrl.replace(/\/$/, "")}/v1/internal/reports/executive-brief`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Landscrape-Internal-Key": config.internalApiKey,
    },
    body: JSON.stringify({ tenantId, title, signalLimit }),
    signal: AbortSignal.timeout(config.agentTimeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Agent executive brief failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return response.json() as Promise<{ bodyMarkdown: string; citations: string[]; signalIds: string[] }>;
}

export async function buildExecutiveBrief(
  tenantId: string,
  title: string,
  options?: { useAgent?: boolean }
): Promise<{ reportId?: string; bodyMarkdown?: string; briefJobId?: string; status?: string }> {
  if (options?.useAgent) {
    const briefJobId = randomUUID();
    await createBriefJob(tenantId, title, 5, briefJobId);

    const payload: AgentBriefPayload = {
      tenantId,
      title,
      signalLimit: 5,
      briefJobId,
    };
    const q = createQueue("agent:brief");
    await q.add("agent:brief", payload, userJobOptions());

    return { briefJobId, status: "queued" };
  }

  const signals = await listSignalsByTenant(tenantId, 5);
  const sections: string[] = [];

  for (const signal of signals) {
    const { summary: enrichedSummary, usage } = await generateSummary(
      {
        title: signal.title,
        summary: signal.summary,
        signalType: signal.signalType,
      },
      { priority: "interactive" }
    );

    void recordOllamaUsage({
      tenantId,
      operation: "generate",
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalDurationNs: usage.totalDurationNs,
      referenceType: "executive_brief_signal",
      referenceId: signal.signalId,
    }).catch((err) => console.error("[ollama-usage] record failed (executive_brief_signal)", err));

    sections.push(
      `## ${signal.title}\n\n- Type: ${signal.signalType}\n- Importance: ${signal.importanceScore}\n- Confidence: ${signal.confidenceScore}\n\n${enrichedSummary}`
    );
  }

  const bodyMarkdown = [
    `# ${title}`,
    "",
    "LandScrape generated the following executive-ready summary from the latest high-signal items:",
    "",
    ...sections,
  ].join("\n");

  const report = await createReportFromSignals(
    tenantId,
    title,
    "executive_brief",
    bodyMarkdown,
    signals.map((signal) => signal.signalId)
  );

  await enqueueDefaultReportExports(tenantId, report.report_id);

  return {
    reportId: report.report_id,
    bodyMarkdown,
  };
}

/** Sync path for internal/agent direct calls only */
export async function buildExecutiveBriefSyncAgent(
  tenantId: string,
  title: string,
  signalLimit = 5
): Promise<{ reportId: string; bodyMarkdown: string }> {
  const agentResult = await fetchAgentExecutiveBrief(tenantId, title, signalLimit);
  const report = await createReportFromSignals(
    tenantId,
    title,
    "executive_brief",
    agentResult.bodyMarkdown,
    agentResult.signalIds
  );
  await enqueueDefaultReportExports(tenantId, report.report_id);
  return {
    reportId: report.report_id,
    bodyMarkdown: agentResult.bodyMarkdown,
  };
}
