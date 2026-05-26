import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { safeReturnUrl, webLoginUrl } from "./safeReturnUrl";

describe("safeReturnUrl", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.WEB_PUBLIC_URL = "https://deliver-impact.com";
    process.env.ADMIN_BASE_URL = "https://deliver-impact.com/admin";
  });

  afterEach(() => {
    process.env = env;
  });

  it("allows relative paths", () => {
    assert.equal(safeReturnUrl("/admin"), "/admin");
    assert.equal(safeReturnUrl("/admin/products?tenant=ayvakit"), "/admin/products?tenant=ayvakit");
  });

  it("rejects protocol-relative and off-host URLs", () => {
    assert.equal(safeReturnUrl("//evil.com/phish"), "/");
    assert.equal(safeReturnUrl("https://evil.com/admin"), "/");
  });

  it("allows absolute URLs on configured hosts", () => {
    assert.equal(safeReturnUrl("https://deliver-impact.com/admin"), "/admin");
    assert.equal(safeReturnUrl("https://www.deliver-impact.com/admin/activity"), "/admin/activity");
  });
});

describe("webLoginUrl", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.WEB_PUBLIC_URL = "https://deliver-impact.com";
  });

  afterEach(() => {
    process.env = env;
  });

  it("builds login URL with returnUrl and error", () => {
    const url = new URL(webLoginUrl({ returnUrl: "/admin", error: "invalid" }));
    assert.equal(url.origin, "https://deliver-impact.com");
    assert.equal(url.pathname, "/login");
    assert.equal(url.searchParams.get("returnUrl"), "/admin");
    assert.equal(url.searchParams.get("error"), "invalid");
  });
});
