import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import {
  decodeJwtExp,
  fetchKeycloakTokenRefresh,
  isDefinitiveTokenFailure,
  isJwtExpired,
  keycloakConfigFromEnv,
  parseLandscrapeClaims,
  verifyAccessToken,
  type KeycloakTokenResponse
} from "@landscrape/auth";
import type { SessionData, StoredSession } from "./sessionTypes";
import { defaultSessionMaxAgeSeconds, deleteSessionCookieFromStore, SESSION_COOKIE, type RequestCookies } from "./sessionCookie";

const KEY_PREFIX = "landscrape:session:";

type SessionAuthDeps = {
  verifyAccessToken: typeof verifyAccessToken;
  isDefinitiveTokenFailure: typeof isDefinitiveTokenFailure;
  fetchKeycloakTokenRefresh: typeof fetchKeycloakTokenRefresh;
};

const defaultSessionAuthDeps = (): SessionAuthDeps => ({
  verifyAccessToken,
  isDefinitiveTokenFailure,
  fetchKeycloakTokenRefresh
});

let sessionAuthDeps: SessionAuthDeps = defaultSessionAuthDeps();

/** @internal Test-only override for session auth dependencies. */
export function __setSessionAuthDepsForTests(overrides: Partial<SessionAuthDeps>): void {
  sessionAuthDeps = { ...defaultSessionAuthDeps(), ...overrides };
}

/** @internal Restore default session auth dependencies after tests. */
export function __resetSessionAuthDepsForTests(): void {
  sessionAuthDeps = defaultSessionAuthDeps();
}

let redisClient: Redis | null = null;

function redisUrl(): string {
  return process.env.REDIS_URL?.trim() || "redis://redis:6379";
}

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisUrl(), { maxRetriesPerRequest: 2, lazyConnect: true });
  }
  return redisClient;
}

function sessionKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

function shouldSkipJwtVerify(): boolean {
  return process.env.SESSION_SKIP_JWT_VERIFY === "true";
}

function ttlSeconds(tokens: KeycloakTokenResponse): number {
  const fromRefresh = tokens.refresh_expires_in;
  if (typeof fromRefresh === "number" && fromRefresh > 0) return fromRefresh;
  const fromEnv = defaultSessionMaxAgeSeconds();
  return fromEnv;
}

function expiresAtFromAccessToken(accessToken: string): number {
  const exp = decodeJwtExp(accessToken);
  return exp ?? Math.floor(Date.now() / 1000) + 300;
}

function sessionFromTokens(tokens: KeycloakTokenResponse, emailFallback?: string): StoredSession {
  const refreshToken = tokens.refresh_token?.trim();
  if (!refreshToken) {
    throw new Error("Keycloak did not return a refresh token");
  }
  const payload = JSON.parse(
    Buffer.from(tokens.access_token.split(".")[1], "base64url").toString("utf8")
  ) as Record<string, unknown>;
  const claims = parseLandscrapeClaims(payload);
  const email = claims.email || emailFallback || "";
  return {
    accessToken: tokens.access_token,
    refreshToken,
    email,
    claims,
    expiresAt: expiresAtFromAccessToken(tokens.access_token)
  };
}

async function saveSession(id: string, data: StoredSession, ttl: number): Promise<void> {
  const redis = getRedis();
  await redis.set(sessionKey(id), JSON.stringify(data), "EX", ttl);
}

export async function createSession(
  tokens: KeycloakTokenResponse,
  emailFallback?: string
): Promise<string> {
  const data = sessionFromTokens(tokens, emailFallback);
  const id = randomUUID();
  const ttl = ttlSeconds(tokens);
  await saveSession(id, data, ttl);
  return id;
}

async function refreshStoredSession(id: string, data: StoredSession): Promise<SessionData | null> {
  const config = keycloakConfigFromEnv();
  if (!config) return null;

  try {
    const tokens = await sessionAuthDeps.fetchKeycloakTokenRefresh(config, data.refreshToken);
    const updated = sessionFromTokens(tokens, data.email);
    const ttl = ttlSeconds(tokens);
    await saveSession(id, updated, ttl);
    return updated;
  } catch {
    await destroySession(id);
    return null;
  }
}

async function verifyStoredAccessToken(accessToken: string): Promise<"valid" | "invalid" | "unknown"> {
  const config = keycloakConfigFromEnv();
  if (!config) return "unknown";

  try {
    await sessionAuthDeps.verifyAccessToken(accessToken, config);
    return "valid";
  } catch (err) {
    if (sessionAuthDeps.isDefinitiveTokenFailure(err)) return "invalid";
    return "unknown";
  }
}

/** Read session from Redis without refreshing tokens (e.g. logout). */
export async function readSession(id: string): Promise<SessionData | null> {
  const trimmed = id?.trim();
  if (!trimmed) return null;

  const redis = getRedis();
  const raw = await redis.get(sessionKey(trimmed));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function loadSession(id: string): Promise<SessionData | null> {
  const trimmed = id?.trim();
  if (!trimmed) return null;

  const redis = getRedis();
  const raw = await redis.get(sessionKey(trimmed));
  if (!raw) return null;

  let data: StoredSession;
  try {
    data = JSON.parse(raw) as StoredSession;
  } catch {
    await destroySession(trimmed);
    return null;
  }

  const exp = decodeJwtExp(data.accessToken);
  if (exp === null || isJwtExpired(exp)) {
    return refreshStoredSession(trimmed, data);
  }

  if (!shouldSkipJwtVerify()) {
    const verified = await verifyStoredAccessToken(data.accessToken);
    if (verified === "valid") {
      return data;
    }
    if (verified === "invalid") {
      return refreshStoredSession(trimmed, data);
    }
  }

  return data;
}

/** Clear browser cookie when it references a missing or invalid Redis session. */
export async function clearOrphanSessionCookie(cookieStore: RequestCookies): Promise<void> {
  const id = cookieStore.get(SESSION_COOKIE)?.value?.trim();
  if (!id) return;
  const session = await loadSession(id);
  if (!session) {
    deleteSessionCookieFromStore(cookieStore);
  }
}

export async function destroySession(id: string): Promise<void> {
  const trimmed = id?.trim();
  if (!trimmed) return;
  const redis = getRedis();
  await redis.del(sessionKey(trimmed));
}

/** For tests — close Redis connection. */
export async function closeSessionStore(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
