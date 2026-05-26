import test from "node:test";
import assert from "node:assert/strict";
import { selectDueForEnqueue, sortDueCandidates } from "./schedulerUtils";
import { isXSocialSource } from "./socialSource";

test("sortDueCandidates orders never-checked before oldest last_checked_at", () => {
  const rows = [
    {
      source_id: "a",
      tenant_id: "t",
      tenant_slug: "ayvakit",
      source_type: "news",
      poll_frequency_minutes: 180,
      last_checked_at: new Date("2026-05-25T12:00:00Z"),
      source_config: null,
    },
    {
      source_id: "b",
      tenant_id: "t",
      tenant_slug: "ayvakit",
      source_type: "news",
      poll_frequency_minutes: 180,
      last_checked_at: null,
      source_config: null,
    },
    {
      source_id: "c",
      tenant_id: "t",
      tenant_slug: "ayvakit",
      source_type: "news",
      poll_frequency_minutes: 180,
      last_checked_at: new Date("2026-05-25T10:00:00Z"),
      source_config: null,
    },
  ];
  const sorted = sortDueCandidates(rows);
  assert.equal(sorted[0]?.source_id, "b");
  assert.equal(sorted[1]?.source_id, "c");
  assert.equal(sorted[2]?.source_id, "a");
});

test("sortDueCandidates burst cap is applied by caller slice", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    source_id: `s-${i}`,
    tenant_id: "t",
    tenant_slug: "ayvakit",
    source_type: "news",
    poll_frequency_minutes: 180,
    last_checked_at: null,
    source_config: null,
  }));
  const burst = sortDueCandidates(rows).slice(0, 8);
  assert.equal(burst.length, 8);
});

test("selectDueForEnqueue always includes due X social sources beyond burst cap", () => {
  const news = Array.from({ length: 12 }, (_, i) => ({
    source_id: `news-${i}`,
    tenant_id: "t",
    tenant_slug: "ayvakit",
    source_type: "news",
    poll_frequency_minutes: 180,
    last_checked_at: null,
    source_config: null,
  }));

  const social = [
    {
      source_id: "social-1",
      tenant_id: "t",
      tenant_slug: "ayvakit",
      source_type: "social",
      poll_frequency_minutes: 120,
      last_checked_at: null,
      source_config: { provider: "x", connectorId: "78f5ae69-51b2-4b0a-b975-61ed074aed66" },
    },
  ];

  const { social: socialSelected, other: otherSelected } = selectDueForEnqueue([...news, ...social], 8, isXSocialSource);
  assert.equal(socialSelected.length, 1);
  assert.equal(socialSelected[0]?.source_id, "social-1");
  assert.equal(otherSelected.length, 8);
});
