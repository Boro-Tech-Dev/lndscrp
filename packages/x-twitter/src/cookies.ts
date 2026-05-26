import { getConfig } from "@landscrape/config";
import type { XCredentials } from "./types";

export function buildCookieHeader(credentials: XCredentials): string {
  const authToken = credentials.authToken.trim();
  const ct0 = credentials.ct0.trim();
  if (!authToken || !ct0) {
    throw new Error("X credentials require authToken and ct0");
  }
  return `auth_token=${authToken}; ct0=${ct0}`;
}

export function parseCredentialsFromSecrets(secrets: Record<string, unknown>): XCredentials {
  const authToken =
    (typeof secrets.authToken === "string" && secrets.authToken) ||
    (typeof secrets.auth_token === "string" && secrets.auth_token) ||
    "";
  const ct0 = typeof secrets.ct0 === "string" ? secrets.ct0 : "";
  if (!authToken) {
    throw new Error("social connector secrets must include authToken (or auth_token)");
  }
  const requireCt0 = getConfig().xBackend === "http";
  if (requireCt0 && !ct0) {
    throw new Error("social connector secrets must include ct0 when LANDSCRAPE_X_BACKEND=http");
  }
  return { authToken, ct0 };
}
