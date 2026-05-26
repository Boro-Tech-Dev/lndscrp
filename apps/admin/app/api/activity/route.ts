import { NextResponse } from "next/server";
import { hasAdminRole } from "@landscrape/auth";
import { authEnabled } from "../../lib/auth/constants";
import { getServerAccessToken, requireSession } from "../../lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (authEnabled()) {
    const session = await requireSession();
    if (!hasAdminRole(session.claims)) {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }
  }

  const token = await getServerAccessToken();
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://api:4000";
  const url = new URL(`${baseUrl}/v1/admin/activity`);
  const incoming = new URL(request.url);
  const since = incoming.searchParams.get("since");
  const limit = incoming.searchParams.get("limit");
  if (since) url.searchParams.set("since", since);
  if (limit) url.searchParams.set("limit", limit);

  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), { cache: "no-store", headers });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
