import test from "node:test";
import assert from "node:assert/strict";
import type { SourceRow } from "../ingestTypes";
import { buildClinicalTrialsV2Url } from "./clinicalTrials";

test("buildClinicalTrialsV2Url encodes ClinicalTrials.gov v2 query params", () => {
  const source: SourceRow = {
    source_id: "00000000-0000-0000-0000-000000000000",
    external_id: null,
    source_name: "CT",
    source_type: "congress",
    base_url: null,
    source_config: { "query.cond": "Mastocytosis", "query.intr": "bezuclastinib", pageSize: 12 },
  };
  const url = buildClinicalTrialsV2Url(source);
  assert.ok(url.startsWith("https://clinicaltrials.gov/api/v2/studies?"));
  assert.ok(url.includes("query.cond=Mastocytosis"));
  assert.ok(url.includes("query.intr=bezuclastinib"));
  assert.ok(url.includes("pageSize=12"));
});
