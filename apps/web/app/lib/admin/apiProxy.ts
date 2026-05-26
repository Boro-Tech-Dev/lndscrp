import { hasAdminRole } from "@landscrape/auth";
import { authEnabled } from "../auth/constants";
import { getServerAccessToken, getSession } from "../auth/session";

export async function adminApiHeaders(): Promise<{
  headers: HeadersInit;
  unauthorized: boolean;
  status?: number;
}> {
  if (authEnabled()) {
    const session = await getSession();
    if (!session) {
      return { headers: {}, unauthorized: true, status: 401 };
    }
    if (!hasAdminRole(session.claims)) {
      return { headers: {}, unauthorized: true, status: 403 };
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
