import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { authCookieSecure } from "./cookies";

describe("authCookieSecure", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.AUTH_COOKIE_SECURE;
  });

  afterEach(() => {
    process.env = env;
  });

  it("returns true when NODE_ENV is production and flag unset", () => {
    process.env.NODE_ENV = "production";
    assert.equal(authCookieSecure(), true);
  });

  it("returns false when NODE_ENV is development and flag unset", () => {
    process.env.NODE_ENV = "development";
    assert.equal(authCookieSecure(), false);
  });

  it("AUTH_COOKIE_SECURE=false overrides production NODE_ENV", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_COOKIE_SECURE = "false";
    assert.equal(authCookieSecure(), false);
  });

  it("AUTH_COOKIE_SECURE=true overrides development NODE_ENV", () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_COOKIE_SECURE = "true";
    assert.equal(authCookieSecure(), true);
  });
});
