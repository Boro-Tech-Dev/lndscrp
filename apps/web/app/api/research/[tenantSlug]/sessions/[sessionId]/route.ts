import { NextRequest } from "next/server";
import { authorizedFetch } from "../../../../../lib/api";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenantSlug: string; sessionId: string }> }
): Promise<Response> {
  const { tenantSlug, sessionId } = await ctx.params;
  const body = await req.json();
  const isMessage = typeof body.message === "string";
  const path = isMessage
    ? `/v1/tenants/${tenantSlug}/agent/sessions/${sessionId}/messages`
    : `/v1/tenants/${tenantSlug}/agent/sessions/${sessionId}`;
  const res = await authorizedFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (res.status === 202) {
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  }

  if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ tenantSlug: string; sessionId: string }> }
): Promise<Response> {
  const { tenantSlug, sessionId } = await ctx.params;
  const res = await authorizedFetch(`/v1/tenants/${tenantSlug}/agent/sessions/${sessionId}`);
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
