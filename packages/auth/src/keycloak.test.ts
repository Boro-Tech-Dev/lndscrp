import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { errors as joseErrors } from "jose";
import { isDefinitiveRefreshFailure, isDefinitiveTokenFailure } from "./keycloak";

const { JWKSNoMatchingKey, JWSSignatureVerificationFailed, JWKSTimeout, JWTClaimValidationFailed } =
  joseErrors;

describe("isDefinitiveTokenFailure", () => {
  it("returns true for invalid token / JWKS errors", () => {
    assert.equal(isDefinitiveTokenFailure(new JWKSNoMatchingKey()), true);
    assert.equal(isDefinitiveTokenFailure(new JWSSignatureVerificationFailed()), true);
    assert.equal(
      isDefinitiveTokenFailure(new JWTClaimValidationFailed("bad", {}, "iss", "check")),
      true
    );
  });

  it("returns false for transient JWKS fetch errors", () => {
    assert.equal(isDefinitiveTokenFailure(new JWKSTimeout()), false);
  });

  it("returns false for non-JOSE errors", () => {
    assert.equal(isDefinitiveTokenFailure(new Error("network down")), false);
    assert.equal(isDefinitiveTokenFailure(null), false);
  });
});

describe("isDefinitiveRefreshFailure", () => {
  it("returns true for invalid_grant and 400/401 token errors", () => {
    assert.equal(isDefinitiveRefreshFailure(new Error("invalid_grant")), true);
    assert.equal(
      isDefinitiveRefreshFailure(
        new Error('Keycloak token request failed (400): {"error":"invalid_grant"}')
      ),
      true
    );
    assert.equal(
      isDefinitiveRefreshFailure(new Error("Keycloak token request failed (401): unauthorized")),
      true
    );
  });

  it("returns false for transient network errors", () => {
    assert.equal(isDefinitiveRefreshFailure(new Error("fetch failed")), false);
    assert.equal(
      isDefinitiveRefreshFailure(new Error("Keycloak token request failed (503): unavailable")),
      false
    );
    assert.equal(isDefinitiveRefreshFailure(null), false);
  });
});
