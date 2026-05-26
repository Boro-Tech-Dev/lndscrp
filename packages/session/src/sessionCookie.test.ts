import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SESSION_COOKIE, deleteSessionCookieFromStore } from "./sessionCookie";
import { clearOrphanSessionCookie, closeSessionStore, createSession, destroySession } from "./sessionStore";

function fakeAccessToken(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds, sub: "u1" })).toString("base64url");
  return `hdr.${payload}.sig`;
}

describe("clearOrphanSessionCookie", () => {
  it("deletes cookie when Redis session is missing", async () => {
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    process.env.SESSION_SKIP_JWT_VERIFY = "true";

    const deleted: Array<{ name: string; path: string; domain?: string }> = [];
    const cookieStore = {
      get: (name: string) =>
        name === SESSION_COOKIE ? { value: "00000000-0000-4000-8000-000000000099" } : undefined,
      delete: (options: { name: string; path: string; domain?: string }) => {
        deleted.push(options);
      }
    };

    await clearOrphanSessionCookie(cookieStore);
    assert.ok(deleted.some((d) => d.name === SESSION_COOKIE));

    delete process.env.SESSION_SKIP_JWT_VERIFY;
    await closeSessionStore();
  });

  it("keeps cookie when Redis session is valid", async () => {
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    process.env.SESSION_SKIP_JWT_VERIFY = "true";

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const id = await createSession({
      access_token: fakeAccessToken(exp),
      refresh_token: "refresh-token-value",
      expires_in: 3600,
      refresh_expires_in: 7200,
      token_type: "Bearer"
    });

    const deleted: Array<{ name: string; path: string; domain?: string }> = [];
    const cookieStore = {
      get: (name: string) => (name === SESSION_COOKIE ? { value: id } : undefined),
      delete: (options: { name: string; path: string; domain?: string }) => {
        deleted.push(options);
      }
    };

    await clearOrphanSessionCookie(cookieStore);
    assert.equal(deleted.length, 0);

    await destroySession(id);
    delete process.env.SESSION_SKIP_JWT_VERIFY;
    await closeSessionStore();
  });

  it("keeps cookie when Redis row exists even if access token is expired", async () => {
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

    const exp = Math.floor(Date.now() / 1000) - 60;
    const id = await createSession({
      access_token: fakeAccessToken(exp),
      refresh_token: "refresh-token-value",
      expires_in: 3600,
      refresh_expires_in: 7200,
      token_type: "Bearer"
    });

    const deleted: Array<{ name: string; path: string; domain?: string }> = [];
    const cookieStore = {
      get: (name: string) => (name === SESSION_COOKIE ? { value: id } : undefined),
      delete: (options: { name: string; path: string; domain?: string }) => {
        deleted.push(options);
      }
    };

    await clearOrphanSessionCookie(cookieStore);
    assert.equal(deleted.length, 0);

    await destroySession(id);
    await closeSessionStore();
  });

  it("deleteSessionCookieFromStore removes cookie with path and domain options", () => {
    const deleted: Array<{ name: string; path: string; domain?: string }> = [];
    deleteSessionCookieFromStore({
      get: () => undefined,
      delete: (options) => {
        deleted.push(options);
      }
    });
    assert.equal(deleted.filter((d) => d.name === SESSION_COOKIE).length, 2);
  });
});
