import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isPublicHostname, requestPublicOrigin } from "./requestPublicOrigin";

describe("isPublicHostname", () => {
  it("rejects Docker container short ids", () => {
    assert.equal(isPublicHostname("e6f7f621c25c"), false);
    assert.equal(isPublicHostname("e6f7f621c25c:3000"), false);
  });

  it("accepts public domains and localhost", () => {
    assert.equal(isPublicHostname("deliver-impact.com"), true);
    assert.equal(isPublicHostname("admin.deliver-impact.com:443"), true);
    assert.equal(isPublicHostname("localhost"), true);
    assert.equal(isPublicHostname("localhost:3000"), true);
  });
});

describe("requestPublicOrigin", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.WEB_PUBLIC_URL;
    delete process.env.ADMIN_BASE_URL;
  });

  afterEach(() => {
    process.env = env;
  });

  it("prefers preferredEnv over forwarded headers", () => {
    process.env.WEB_PUBLIC_URL = "https://deliver-impact.com";
    const request = new Request("http://e6f7f621c25c:3000/", {
      headers: {
        "x-forwarded-host": "wrong.example.com",
        "x-forwarded-proto": "https"
      }
    });
    assert.equal(
      requestPublicOrigin(request, { preferredEnv: "WEB_PUBLIC_URL" }),
      "https://deliver-impact.com"
    );
  });

  it("uses x-forwarded-host when env unset", () => {
    const request = new Request("http://e6f7f621c25c:3000/login", {
      headers: {
        "x-forwarded-host": "deliver-impact.com",
        "x-forwarded-proto": "https"
      }
    });
    assert.equal(requestPublicOrigin(request), "https://deliver-impact.com");
  });

  it("does not use internal request.url host", () => {
    const request = new Request("http://e6f7f621c25c:3000/login");
    assert.equal(
      requestPublicOrigin(request, { devFallback: "http://localhost:3000" }),
      "http://localhost:3000"
    );
  });
});
