import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { errors as joseErrors } from "jose";
import { isDefinitiveTokenFailure } from "./keycloak";

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
