import type { Worker } from "bullmq";
import { getConfig } from "@landscrape/config";
import { createWorkerForQueue, enqueueDefaultReportExports } from "@landscrape/jobs";
import type { AgentTurnPayload } from "@landscrape/jobs";
import { runResearchTurn } from "./agentService";
import {
  completeAgentTurn,
  failAgentTurn,
  markAgentTurnActive,
} from "./repositories/turnRepository";

const workers: Worker[] = [];

export function startAgentTurnWorker(): void {
  const { agentTurnConcurrency } = getConfig();
  const worker = createWorkerForQueue(
    "agent:turn",
    async (data, jobId) => {
      const payload = data as AgentTurnPayload;
      await markAgentTurnActive(payload.turnId, jobId);
      try {
        const result = await runResearchTurn({
          tenantId: payload.tenantId,
          sessionId: payload.sessionId,
          userMessage: payload.userMessage,
          mode: "interactive",
          skipUserMessageInsert: true,
        });
        await completeAgentTurn(payload.turnId, result.assistantMessage, result.citations);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await failAgentTurn(payload.turnId, msg);
        throw err;
      }
    },
    agentTurnConcurrency
  );
  workers.push(worker);
  console.log("[agent] agent:turn worker started");
}

export function startAgentBriefWorker(): void {
  const { agentBriefConcurrency } = getConfig();
  const worker = createWorkerForQueue(
    "agent:brief",
    async (data, jobId) => {
      const payload = data as import("@landscrape/jobs").AgentBriefPayload;
      const { markBriefJobActive, completeBriefJob, failBriefJob } = await import(
        "./repositories/briefJobRepository"
      );
      const { buildExecutiveBriefWithAgent } = await import("./agentService");
      const { createReportFromBrief } = await import("./repositories/turnRepository");

      await markBriefJobActive(payload.briefJobId, jobId);
      try {
        const result = await buildExecutiveBriefWithAgent(
          payload.tenantId,
          payload.title,
          payload.signalLimit ?? 5
        );
        const reportId = await createReportFromBrief(
          payload.tenantId,
          payload.title,
          result.bodyMarkdown,
          result.signalIds
        );
        await enqueueDefaultReportExports(payload.tenantId, reportId);
        await completeBriefJob(
          payload.briefJobId,
          reportId,
          result.bodyMarkdown,
          result.citations,
          result.signalIds
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await failBriefJob(payload.briefJobId, msg);
        throw err;
      }
    },
    agentBriefConcurrency
  );
  workers.push(worker);
  console.log("[agent] agent:brief worker started");
}

export async function closeAgentWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
}

export function getAgentWorkerCount(): number {
  return workers.length;
}
