import { cookies } from "next/headers";
import { loadSession, SESSION_COOKIE, type SessionData } from "@landscrape/session";
import { authEnabled } from "./constants";

export type AuthSession = SessionData;

export async function getSession(): Promise<SessionData | null> {
  if (!authEnabled()) return null;
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value?.trim();
  if (!id) return null;
  return loadSession(id);
}

export async function getServerAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.accessToken ?? null;
}
