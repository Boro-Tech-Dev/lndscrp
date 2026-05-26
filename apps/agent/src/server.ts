import express from "express";
import cors from "cors";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getConfig } from "@landscrape/config";
import { createQueue, getQueueDepth, userJobOptions } from "@landscrape/jobs";
import type { AgentTurnPayload } from "@landscrape/jobs";
import { requireAuth, requireTenant } from "./middleware/auth";
import { requireInternalApiKey } from "./middleware/internalKey";
import {
  createSession,
  getSession,
  insertMessage,
  listMessages,
  resolveTenantId,
} from "./repositories/sessionRepository";
import {
  buildExecutiveBriefWithAgent,
  enrichSignalWithAgent,
  runOneShotResearch,
  runResearchTurn,
} from "./agentService";
import {
  createAgentTurn,
  getAgentTurn,
} from "./repositories/turnRepository";
import {
  closeAgentWorkers,
  getAgentWorkerCount,
  startAgentBriefWorker,
  startAgentTurnWorker,
} from "./agentTurnWorker";

function pathParam(req: express.Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const app = express();
const config = getConfig();
const role = config.agentServiceRole;

if (config.authEnabled) {
  app.use(
    cors({
      origin: config.authCorsOrigins,
      credentials: true,
    })
  );
} else {
  app.use(cors());
}
app.use(express.json());

app.get("/health", async (_req, res) => {
  const queueDepth =
    role === "user" || role === "full"
      ? await getQueueDepth("agent:turn").catch(() => null)
      : null;
  res.json({
    status: "ok",
    service: "landscrape-agent",
    role,
    queueDepth,
    workers: getAgentWorkerCount(),
    timestamp: new Date().toISOString(),
  });
});

function registerEnrichRoutes(): void {
  if (role === "user") return;

  app.post("/v1/internal/enrich/signal", requireInternalApiKey, async (req, res) => {
    const body = z
      .object({
        tenantId: z.string().uuid(),
        signalId: z.string().uuid(),
        title: z.string().min(1),
        summary: z.string().min(1),
      })
      .safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Invalid request body", issues: body.error.issues });
    }

    try {
      const result = await enrichSignalWithAgent(
        body.data.tenantId,
        body.data.signalId,
        body.data.title,
        body.data.summary
      );
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Enrichment failed" });
    }
  });
}

function registerUserRoutes(): void {
  if (role === "enrich") return;

  app.post("/v1/internal/reports/executive-brief", requireInternalApiKey, async (req, res) => {
    const body = z
      .object({
        tenantId: z.string().uuid(),
        title: z.string().min(5).max(200),
        signalLimit: z.number().int().min(1).max(20).optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Invalid request body", issues: body.error.issues });
    }

    try {
      const result = await buildExecutiveBriefWithAgent(
        body.data.tenantId,
        body.data.title,
        body.data.signalLimit ?? 5
      );
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Brief failed" });
    }
  });

  app.post("/v1/tenants/:tenantSlug/agent/sessions", requireAuth, requireTenant, async (req, res) => {
    const tenantSlug = pathParam(req, "tenantSlug");
    const tenantId = await resolveTenantId(tenantSlug);
    if (!tenantId) return res.status(404).json({ error: "Tenant not found" });

    const body = z.object({ title: z.string().max(200).optional() }).safeParse(req.body ?? {});
    const title = body.success && body.data.title ? body.data.title : "Research session";
    const userId = req.auth?.sub ?? req.auth?.email ?? "anonymous";
    const sessionId = await createSession(tenantId, userId, title);
    return res.status(201).json({ sessionId, title });
  });

  app.get("/v1/tenants/:tenantSlug/agent/sessions/:sessionId", requireAuth, requireTenant, async (req, res) => {
    const tenantSlug = pathParam(req, "tenantSlug");
    const sessionId = pathParam(req, "sessionId");
    const tenantId = await resolveTenantId(tenantSlug);
    if (!tenantId) return res.status(404).json({ error: "Tenant not found" });

    const session = await getSession(sessionId, tenantId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const messages = await listMessages(sessionId);
    return res.json({ session, messages });
  });

  app.post("/v1/tenants/:tenantSlug/agent/sessions/:sessionId/messages", requireAuth, requireTenant, async (req, res) => {
    const tenantSlug = pathParam(req, "tenantSlug");
    const sessionId = pathParam(req, "sessionId");
    const tenantId = await resolveTenantId(tenantSlug);
    if (!tenantId) return res.status(404).json({ error: "Tenant not found" });

    const session = await getSession(sessionId, tenantId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const body = z.object({ message: z.string().min(1).max(4000) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid message body" });

    if (config.agentTurnQueue) {
      const turnId = randomUUID();
      await createAgentTurn(tenantId, sessionId, body.data.message, turnId);
      await insertMessage(sessionId, "user", body.data.message);

      const payload: AgentTurnPayload = {
        tenantId,
        sessionId,
        userMessage: body.data.message,
        turnId,
      };
      const q = createQueue("agent:turn");
      await q.add("agent:turn", payload, userJobOptions());
      return res.status(202).json({ turnId, status: "queued" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      send("status", { phase: "thinking" });
      const result = await runResearchTurn({
        tenantId,
        sessionId,
        userMessage: body.data.message,
        mode: "interactive",
      });
      send("delta", { content: result.assistantMessage });
      send("done", { citations: result.citations });
      res.end();
    } catch (err) {
      send("error", { message: err instanceof Error ? err.message : "Agent failed" });
      res.end();
    }
  });

  app.get(
    "/v1/tenants/:tenantSlug/agent/sessions/:sessionId/turns/:turnId/stream",
    requireAuth,
    requireTenant,
    async (req, res) => {
      const tenantSlug = pathParam(req, "tenantSlug");
      const sessionId = pathParam(req, "sessionId");
      const turnId = pathParam(req, "turnId");
      const tenantId = await resolveTenantId(tenantSlug);
      if (!tenantId) return res.status(404).json({ error: "Tenant not found" });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const poll = async (): Promise<void> => {
        const turn = await getAgentTurn(turnId, tenantId, sessionId);
        if (!turn) {
          send("error", { message: "Turn not found" });
          res.end();
          return;
        }

        if (turn.status === "queued" || turn.status === "active") {
          send("status", { status: turn.status });
          setTimeout(() => {
            poll().catch((err) => {
              send("error", { message: err instanceof Error ? err.message : "Stream failed" });
              res.end();
            });
          }, 500);
          return;
        }

        if (turn.status === "failed") {
          send("error", { message: turn.error_message ?? "Agent failed" });
          res.end();
          return;
        }

        send("delta", { content: turn.assistant_message ?? "" });
        send("done", { citations: turn.citations });
        res.end();
      };

      try {
        await poll();
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Stream failed" });
        res.end();
      }
    }
  );

  app.post("/v1/tenants/:tenantSlug/research", requireAuth, requireTenant, async (req, res) => {
    const tenantSlug = pathParam(req, "tenantSlug");
    const tenantId = await resolveTenantId(tenantSlug);
    if (!tenantId) return res.status(404).json({ error: "Tenant not found" });

    const body = z.object({ query: z.string().min(1).max(4000) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid query" });

    try {
      const result = await runOneShotResearch(tenantId, body.data.query);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Research failed" });
    }
  });
}

registerEnrichRoutes();
registerUserRoutes();

if (role === "user" || role === "full") {
  if (config.agentTurnQueue) {
    startAgentTurnWorker();
    startAgentBriefWorker();
  }
}

const shutdown = async (signal: string) => {
  console.log(`[agent] ${signal} received, closing workers…`);
  try {
    await closeAgentWorkers();
    process.exit(0);
  } catch (err) {
    console.error("[agent] shutdown error", err);
    process.exit(1);
  }
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

const port = config.agentPort;
app.listen(port, () => {
  console.log(`[agent] listening on :${port} role=${role}`);
});
