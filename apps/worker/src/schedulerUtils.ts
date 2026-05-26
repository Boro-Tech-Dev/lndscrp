export interface DueSourceCandidate {
  source_id: string;
  tenant_id: string;
  tenant_slug: string;
  source_type: string;
  poll_frequency_minutes: number;
  last_checked_at: Date | null;
  source_config: Record<string, unknown> | null;
}

export function sortDueCandidates(rows: DueSourceCandidate[]): DueSourceCandidate[] {
  return [...rows].sort((a, b) => {
    if (!a.last_checked_at && !b.last_checked_at) return 0;
    if (!a.last_checked_at) return -1;
    if (!b.last_checked_at) return 1;
    return new Date(a.last_checked_at).getTime() - new Date(b.last_checked_at).getTime();
  });
}

export function selectDueForEnqueue(
  rows: DueSourceCandidate[],
  schedulerBurstLimit: number,
  isSocial: (row: DueSourceCandidate) => boolean
): { social: DueSourceCandidate[]; other: DueSourceCandidate[] } {
  const sorted = sortDueCandidates(rows);
  const social: DueSourceCandidate[] = [];
  const other: DueSourceCandidate[] = [];
  for (const row of sorted) {
    if (isSocial(row)) social.push(row);
    else other.push(row);
  }
  return { social, other: other.slice(0, schedulerBurstLimit) };
}
