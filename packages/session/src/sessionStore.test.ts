import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { closeSessionStore, createSession, destroySession, loadSession } from "./sessionStore";

function fakeAccessToken(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url");
  return `hdr.${payload}.sig`;
}

describe("sessionStore", () => {
  before(() => {
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  });

  after(async () => {
    await closeSessionStore();
  });

  it("createSession → loadSession returns session data", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const tokens = {
      access_token: fakeAccessToken(exp),
      refresh_token: "refresh-token-value",
      expires_in: 3600,
      refresh_expires_in: 7200,
      token_type: "Bearer"
    };
    const payload = JSON.parse(
      Buffer.from(tokens.access_token.split(".")[1], "base64url").toString("utf8")
    );
    payload.sub = "user-1";
    payload.email = "demo@landscrape.local";
    payload.realm_access = { roles: ["viewer"] };
    payload.groups = ["tenant:ayvakit"];
    const access = `hdr.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
    tokens.access_token = access;

    const id = await createSession(tokens, "demo@landscrape.local");
    const session = await loadSession(id);
    assert.ok(session);
    assert.equal(session.email, "demo@landscrape.local");
    assert.equal(session.accessToken, access);
    await destroySession(id);
  });

  it("destroySession removes session", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const tokens = {
      access_token: fakeAccessToken(exp),
      refresh_token: "refresh-token-value",
      expires_in: 3600,
      refresh_expires_in: 7200,
      token_type: "Bearer"
    };
    const id = await createSession(tokens);
    await destroySession(id);
    const session = await loadSession(id);
    assert.equal(session, null);
  });

  it("loadSession returns null for unknown id", async () => {
    const session = await loadSession("00000000-0000-4000-8000-000000000000");
    assert.equal(session, null);
  });
});
