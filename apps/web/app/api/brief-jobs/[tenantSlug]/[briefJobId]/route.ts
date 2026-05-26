import { authorizedFetch } from "../../../../lib/api";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tenantSlug: string; briefJobId: string }> }
): Promise<Response> {
  const { tenantSlug, briefJobId } = await ctx.params;
  const res = await authorizedFetch(`/v1/tenants/${tenantSlug}/brief-jobs/${briefJobId}`);
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
