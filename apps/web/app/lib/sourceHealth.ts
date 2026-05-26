import type { SourceItem } from "./api";

const HEALTHY_STATUSES = new Set([
  "success",
  "ok",
  "healthy",
  "passed",
  "complete",
  "active",
  "completed",
  "not_modified"
]);

/**
 * Share of sources whose last_status looks healthy; null last_status counts as not healthy.
 * Empty tenant source list returns 100 so the UI does not imply a broken pipeline with no configured sources.
 */
export function computeSourceHealthPercent(items: SourceItem[]): number {
  if (items.length === 0) {
    return 100;
  }

  const ok = items.filter((s) => s.last_status && HEALTHY_STATUSES.has(s.last_status.toLowerCase())).length;
  return Math.round((ok / items.length) * 100);
}
