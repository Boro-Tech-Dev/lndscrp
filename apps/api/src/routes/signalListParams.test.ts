import test from "node:test";
import assert from "node:assert/strict";
import { parseSignalListParams } from "./signalListParams";

test("parseSignalListParams clamps and defaults", () => {
  const p = parseSignalListParams({});
  assert.equal(p.limit, 50);
  assert.equal(p.offset, 0);
  assert.equal(p.sort, "updated_desc");
  assert.deepEqual(p.excludeTypes, []);
});

test("parseSignalListParams accepts hide as excludeTypes alias", () => {
  const p = parseSignalListParams({ hide: "regulatory, social_intelligence, unknown" });
  assert.deepEqual(p.excludeTypes, ["regulatory", "social_intelligence"]);
});

test("parseSignalListParams parses sort and dates", () => {
  const p = parseSignalListParams({
    sort: "importance_desc",
    from: "2026-01-01",
    to: "2026-02-01",
    limit: "25",
    offset: "50"
  });
  assert.equal(p.sort, "importance_desc");
  assert.equal(p.from, "2026-01-01");
  assert.equal(p.to, "2026-02-01");
  assert.equal(p.limit, 25);
  assert.equal(p.offset, 50);
});

