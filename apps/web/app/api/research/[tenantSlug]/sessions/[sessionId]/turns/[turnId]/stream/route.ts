import { NextRequest } from "next/server";
import { authorizedFetch } from "../../../../../../../../lib/api";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ tenantSlug: string; sessionId: string; turnId: string }> }
): Promise<Response> {
  const { tenantSlug, sessionId, turnId } = await ctx.params;
  const res = await authorizedFetch(
    `/v1/tenants/${tenantSlug}/agent/sessions/${sessionId}/turns/${turnId}/stream`
  );

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
