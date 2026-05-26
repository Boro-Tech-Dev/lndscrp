import test from "node:test";
import assert from "node:assert/strict";
import type { SourceRow } from "../ingestTypes";
import { buildOpenFdaUrl } from "./openfda";

test("buildOpenFdaUrl uses api.fda.gov with search and limit", () => {
  const source: SourceRow = {
    source_id: "00000000-0000-0000-0000-000000000000",
    external_id: null,
    source_name: "FDA",
    source_type: "regulatory",
    base_url: null,
    source_config: { provider: "openfda", openfdaSearch: "classification:Class+1", openfdaLimit: 7 },
  };
  const url = buildOpenFdaUrl(source);
  assert.ok(url.startsWith("https://api.fda.gov/drug/enforcement.json"));
  assert.ok(url.includes("limit=7"));
  assert.ok(url.includes("search="));
});
