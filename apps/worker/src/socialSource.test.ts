import test from "node:test";
import assert from "node:assert/strict";
import { isXSocialSource, xSocialConnectorId } from "./socialSource";

const CONNECTOR_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

test("isXSocialSource matches social + provider x + connectorId", () => {
  assert.equal(
    isXSocialSource({
      source_type: "social",
      source_config: { provider: "x", connectorId: CONNECTOR_ID, mode: "search", query: "test" },
    }),
    true
  );
});

test("isXSocialSource rejects wrong provider or missing connector", () => {
  assert.equal(isXSocialSource({ source_type: "social", source_config: { provider: "linkedin" } }), false);
  assert.equal(isXSocialSource({ source_type: "news", source_config: { provider: "x", connectorId: CONNECTOR_ID } }), false);
  assert.equal(isXSocialSource({ source_type: "social", source_config: { provider: "x" } }), false);
});

test("xSocialConnectorId returns connectorId string", () => {
  assert.equal(
    xSocialConnectorId({ source_config: { connectorId: CONNECTOR_ID } }),
    CONNECTOR_ID
  );
});
