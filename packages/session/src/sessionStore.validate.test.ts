import { describe, it, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import Redis from "ioredis";
import {
  __resetSessionAuthDepsForTests,
  __setSessionAuthDepsForTests,
  closeSessionStore,
  createSession,
  destroySession,
  loadSession
} from "./sessionStore";

function fakeAccessToken(expSeconds: number, sub = "user-1"): string {
  const payload = {
    exp: expSeconds,
    sub,
    email: "demo@landscrape.local",
    realm_access: { roles: ["viewer"] },
    groups: ["tenant:ayvakit"]
  };
  return `hdr.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
}

function fakeTokens(expSeconds: number) {
  return {
    access_token: fakeAccessToken(expSeconds),
    refresh_token: "refresh-token-value",
    expires_in: 3600,
    refresh_expires_in: 7200,
    token_type: "Bearer"
  };
}

describe("loadSession JWT validation", () => {
  beforeEach(() => {
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    process.env.KEYCLOAK_URL = "http://keycloak:8080";
    process.env.KEYCLOAK_REALM = "landscrape";
    process.env.KEYCLOAK_CLIENT_ID = "landscrape-web";
    process.env.KEYCLOAK_CLIENT_SECRET = "secret";
    process.env.KEYCLOAK_ISSUER = "http://keycloak:8080/realms/landscrape";
    delete process.env.SESSION_SKIP_JWT_VERIFY;
    __resetSessionAuthDepsForTests();
  });

  after(async () => {
    __resetSessionAuthDepsForTests();
    await closeSessionStore();
  });

  it("returns session when verify succeeds", async () => {
    __setSessionAuthDepsForTests({
      verifyAccessToken: mock.fn(async () => ({})),
      isDefinitiveTokenFailure: () => false
    });

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const id = await createSession(fakeTokens(exp));
    const session = await loadSession(id);
    assert.ok(session);
    assert.equal(session.email, "demo@landscrape.local");
    await destroySession(id);
  });

  it("refreshes when verify fails definitively and refresh succeeds", async () => {
    const refresh = mock.fn(async () => fakeTokens(Math.floor(Date.now() / 1000) + 7200));
    __setSessionAuthDepsForTests({
      verifyAccessToken: mock.fn(async () => {
        throw new Error("bad sig");
      }),
      isDefinitiveTokenFailure: () => true,
      fetchKeycloakTokenRefresh: refresh
    });

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const id = await createSession(fakeTokens(exp));
    const session = await loadSession(id);
    assert.ok(session);
    assert.equal(refresh.mock.callCount(), 1);
    await destroySession(id);
  });

  it("destroys session when verify fails definitively and refresh fails", async () => {
    __setSessionAuthDepsForTests({
      verifyAccessToken: mock.fn(async () => {
        throw new Error("no applicable key");
      }),
      isDefinitiveTokenFailure: () => true,
      fetchKeycloakTokenRefresh: mock.fn(async () => {
        throw new Error("invalid_grant");
      })
    });

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const id = await createSession(fakeTokens(exp));
    const session = await loadSession(id);
    assert.equal(session, null);

    const redis = new Redis(process.env.REDIS_URL!);
    const raw = await redis.get(`landscrape:session:${id}`);
    assert.equal(raw, null);
    await redis.quit();
  });

  it("returns session unchanged on transient verify failure", async () => {
    const refresh = mock.fn(async () => fakeTokens(Math.floor(Date.now() / 1000) + 7200));
    __setSessionAuthDepsForTests({
      verifyAccessToken: mock.fn(async () => {
        throw new Error("timeout");
      }),
      isDefinitiveTokenFailure: () => false,
      fetchKeycloakTokenRefresh: refresh
    });

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const id = await createSession(fakeTokens(exp));
    const session = await loadSession(id);
    assert.ok(session);
    assert.equal(refresh.mock.callCount(), 0);
    await destroySession(id);
  });
});
