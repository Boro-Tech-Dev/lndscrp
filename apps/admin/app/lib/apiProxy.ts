import { hasAdminRole } from "@landscrape/auth";
import { authEnabled } from "./auth/constants";
import { getServerAccessToken, requireSession } from "./auth/session";

export async function adminApiHeaders(): Promise<{ headers: HeadersInit; unauthorized: boolean }> {
  if (authEnabled()) {
    const session = await requireSession();
    if (!hasAdminRole(session.claims)) {
      return { headers: {}, unauthorized: true };
    }
  }
  const token = await getServerAccessToken();
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return { headers, unauthorized: false };
}

export function apiBaseUrl(): string {
  return process.env.API_INTERNAL_URL ?? "http://api:4000";
}
