import test from "node:test";
import assert from "node:assert/strict";
import type { SourceRow } from "../ingestTypes";
import { isOpenFdaNotFound, parseOpenFdaResponse } from "./openfda";

const source: SourceRow = {
  source_id: "00000000-0000-0000-0000-000000000001",
  external_id: null,
  source_name: "openFDA avapritinib enforcement",
  source_type: "regulatory",
  base_url: null,
  source_config: {
    provider: "openfda",
    openfdaEndpoint: "drug/enforcement.json",
    openfdaSearch: "openfda.brand_name:avapritinib",
    maxItems: 15,
  },
};

test("isOpenFdaNotFound detects FDA NOT_FOUND payload", () => {
  const body = JSON.stringify({ error: { code: "NOT_FOUND", message: "No matches found!" } });
  assert.equal(isOpenFdaNotFound(body), true);
});

test("parseOpenFdaResponse returns empty array on 404 NOT_FOUND", () => {
  const body = JSON.stringify({ error: { code: "NOT_FOUND", message: "No matches found!" } });
  const items = parseOpenFdaResponse(404, "Not Found", "https://api.fda.gov/test", body, source);
  assert.deepEqual(items, []);
});
