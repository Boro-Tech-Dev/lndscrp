import { redirect } from "next/navigation";
import { getServerAccessToken, getSession } from "../auth/session";
import { authEnabled } from "../auth/constants";
import { webLoginUrl } from "@landscrape/auth";

export async function adminBackendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://api:4000";
  const headers = new Headers(init.headers);
  if (authEnabled()) {
    const token = await getServerAccessToken();
    if (!token) {
      const session = await getSession();
      if (!session) {
        redirect(webLoginUrl({ returnUrl: "/admin" }));
      }
      throw new Error("Unauthorized: API token unavailable");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${baseUrl}${path}`, { ...init, headers, cache: init.cache ?? "no-store" });
}
