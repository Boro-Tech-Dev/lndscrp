import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertToolAllowed, assertInputSafe, PhiPolicyError } from "./phiPolicy";

describe("phiPolicy", () => {
  it("allows native pubmed tool", () => {
    assert.doesNotThrow(() => assertToolAllowed("native.pubmed.search"));
    assert.doesNotThrow(() => assertToolAllowed("native.x.search"));
    assert.doesNotThrow(() => assertToolAllowed("native.x.profile"));
  });

  it("denies fhir tools", () => {
    assert.throws(() => assertToolAllowed("epic.fhir.patient"), PhiPolicyError);
  });

  it("rejects SSN in input", () => {
    assert.throws(
      () => assertInputSafe({ note: "patient SSN 123-45-6789" }),
      PhiPolicyError
    );
  });
});
