import type { Request, Response } from "express";
import { getConfig } from "@landscrape/config";

function pathParam(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function forwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = req.headers.authorization;
  if (typeof auth === "string") headers.Authorization = auth;
  return headers;
}

export async function proxyAgentRequest(req: Request, res: Response, agentPath: string): Promise<void> {
  const config = getConfig();
  const url = `${config.agentInternalUrl.replace(/\/$/, "")}${agentPath}`;
  const init: RequestInit = {
    method: req.method,
    headers: forwardHeaders(req),
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = JSON.stringify(req.body ?? {});
  }

  const upstream = await fetch(url, init);

  if (upstream.headers.get("content-type")?.includes("text/event-stream")) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.status(upstream.status);
    if (!upstream.body) {
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
    res.end();
    return;
  }

  const text = await upstream.text();
  res.status(upstream.status);
  const ct = upstream.headers.get("content-type");
  if (ct) res.setHeader("Content-Type", ct);
  res.send(text);
}

export function agentSessionsPath(req: Request): string {
  const tenantSlug = pathParam(req, "tenantSlug");
  return `/v1/tenants/${tenantSlug}/agent/sessions`;
}

export function agentSessionPath(req: Request): string {
  const tenantSlug = pathParam(req, "tenantSlug");
  const sessionId = pathParam(req, "sessionId");
  return `/v1/tenants/${tenantSlug}/agent/sessions/${sessionId}`;
}

export function agentMessagesPath(req: Request): string {
  return `${agentSessionPath(req)}/messages`;
}

export function researchPath(req: Request): string {
  const tenantSlug = pathParam(req, "tenantSlug");
  return `/v1/tenants/${tenantSlug}/research`;
}
