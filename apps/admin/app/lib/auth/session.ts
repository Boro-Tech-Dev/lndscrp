import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteSessionCookieFromStore, loadSession, SESSION_COOKIE, type SessionData } from "@landscrape/session";
import { authEnabled } from "./constants";

export type AuthSession = SessionData;

async function getSessionUncached(): Promise<SessionData | null> {
  if (!authEnabled()) return null;
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value?.trim();
  if (!id) return null;
  return loadSession(id);
}

export const getSession = cache(getSessionUncached);

export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    deleteSessionCookieFromStore(await cookies());
    redirect("/login");
  }
  return session;
}

export async function getServerAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.accessToken ?? null;
}
