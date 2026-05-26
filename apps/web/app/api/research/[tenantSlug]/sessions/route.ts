import { NextRequest } from "next/server";
import { authorizedFetch } from "../../../../lib/api";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenantSlug: string }> }
): Promise<Response> {
  const { tenantSlug } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const res = await authorizedFetch(`/v1/tenants/${tenantSlug}/agent/sessions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
