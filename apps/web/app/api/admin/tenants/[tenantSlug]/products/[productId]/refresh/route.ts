import { NextResponse } from "next/server";
import { adminApiHeaders, apiBaseUrl } from "../../../../../../../lib/admin/apiProxy";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ tenantSlug: string; productId: string }> }
) {
  const { tenantSlug, productId } = await context.params;
  const { headers, unauthorized, status } = await adminApiHeaders();
  if (unauthorized) {
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Admin role required" },
      { status: status ?? 403 }
    );
  }
  const response = await fetch(
    `${apiBaseUrl()}/v1/admin/tenants/${tenantSlug}/products/${productId}/refresh`,
    { method: "POST", headers }
  );
  const text = await response.text();
  return new NextResponse(text, { status: response.status, headers: { "Content-Type": "application/json" } });
}
