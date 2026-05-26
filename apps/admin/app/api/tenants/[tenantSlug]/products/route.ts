import { NextResponse } from "next/server";
import { adminApiHeaders, apiBaseUrl } from "../../../../lib/apiProxy";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await context.params;
  const { headers, unauthorized } = await adminApiHeaders();
  if (unauthorized) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }
  const response = await fetch(`${apiBaseUrl()}/v1/admin/tenants/${tenantSlug}/products`, {
    cache: "no-store",
    headers,
  });
  const body = await response.text();
  return new NextResponse(body, { status: response.status, headers: { "Content-Type": "application/json" } });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await context.params;
  const { headers, unauthorized } = await adminApiHeaders();
  if (unauthorized) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }
  const body = await request.text();
  const response = await fetch(`${apiBaseUrl()}/v1/admin/tenants/${tenantSlug}/products`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body,
  });
  const text = await response.text();
  return new NextResponse(text, { status: response.status, headers: { "Content-Type": "application/json" } });
}
