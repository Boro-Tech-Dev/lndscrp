import { NextResponse } from "next/server";
import { adminApiHeaders, apiBaseUrl } from "../../../../../lib/apiProxy";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await context.params;
  const { headers, unauthorized } = await adminApiHeaders();
  if (unauthorized) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }
  const response = await fetch(
    `${apiBaseUrl()}/v1/admin/tenants/${tenantSlug}/products/bootstrap-enrich`,
    { method: "POST", headers }
  );
  const text = await response.text();
  return new NextResponse(text, { status: response.status, headers: { "Content-Type": "application/json" } });
}
