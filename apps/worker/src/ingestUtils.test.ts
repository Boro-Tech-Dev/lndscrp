import test from "node:test";
import assert from "node:assert/strict";
import { parsePubMedDate, buildStableId } from "./ingestUtils";

test("parsePubMedDate handles year-month-day", () => {
  assert.equal(parsePubMedDate("2026 Apr 15").startsWith("2026-04-15"), true);
});

test("buildStableId is deterministic", () => {
  assert.equal(buildStableId(["a", "b"]), buildStableId(["a", "b"]));
  assert.notEqual(buildStableId(["a", "b"]), buildStableId(["a", "c"]));
});
