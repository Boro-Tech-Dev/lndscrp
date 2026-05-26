import type { LabelUpdateEntry, TrialSummary } from "./types";

const PDUFA_REGEX =
  /(?:PDUFA|pdufa|NDA|BLA|action date|prescription drug user fee)[^.]{0,120}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},? \d{4})/i;

export function parsePdufaFromText(text: string): string | undefined {
  const m = text.match(PDUFA_REGEX);
  if (!m?.[1]) return undefined;
  const d = normalizeDateString(m[1]);
  return d ?? undefined;
}

export function normalizeDateString(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slash) {
    const y = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    const mm = slash[1].padStart(2, "0");
    const dd = slash[2].padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return null;
}

export function addMonthsIso(dateIso: string, months: number): string {
  const d = new Date(dateIso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function phaseScore(phases: string[] | undefined): number {
  if (!phases?.length) return 0;
  const joined = phases.join(" ").toUpperCase();
  if (joined.includes("PHASE3") || joined.includes("PHASE 3")) return 30;
  if (joined.includes("PHASE2") || joined.includes("PHASE 2")) return 20;
  if (joined.includes("PHASE1") || joined.includes("PHASE 1")) return 10;
  return 5;
}

export function mergeLabelUpdates(entries: LabelUpdateEntry[], cap = 5): LabelUpdateEntry[] {
  const byKey = new Map<string, LabelUpdateEntry>();
  for (const e of entries) {
    const key = `${e.date}|${e.source}|${e.title.slice(0, 40)}`;
    if (!byKey.has(key)) byKey.set(key, e);
  }
  return [...byKey.values()]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, cap);
}

export function pickBestTrial(studies: TrialSummary[]): TrialSummary | null {
  if (studies.length === 0) return null;
  const scored = studies.map((s) => {
    let score = phaseScore(s.phases);
    const status = (s.overallStatus ?? "").toUpperCase();
    if (status.includes("RECRUITING") || status.includes("ACTIVE")) score += 5;
    if (status.includes("COMPLETED")) score += 3;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.s ?? null;
}

export function buildTrialFromStudyJson(study: Record<string, unknown>): TrialSummary | null {
  const ps = study.protocolSection as Record<string, unknown> | undefined;
  if (!ps) return null;
  const idMod = ps.identificationModule as Record<string, unknown> | undefined;
  const statusMod = ps.statusModule as Record<string, unknown> | undefined;
  const designMod = ps.designModule as Record<string, unknown> | undefined;
  const descMod = ps.descriptionModule as Record<string, unknown> | undefined;
  const nctId = String(idMod?.nctId ?? "");
  if (!nctId) return null;
  const title = String(idMod?.officialTitle ?? idMod?.briefTitle ?? "");
  const briefSummary = String(descMod?.briefSummary ?? "");
  const phasesRaw = designMod?.phases;
  const phases = Array.isArray(phasesRaw) ? phasesRaw.map(String) : [];
  const primaryCompletion =
    (statusMod?.primaryCompletionDateStruct as { date?: string } | undefined)?.date ??
    (statusMod?.completionDateStruct as { date?: string } | undefined)?.date;
  const overallStatus = String(statusMod?.overallStatus ?? "");
  const pdufaDateFromText = parsePdufaFromText(`${title} ${briefSummary}`);
  let inferredTimelineDate: string | undefined;
  let timelineIsEstimated = false;
  if (!pdufaDateFromText && primaryCompletion) {
    const norm = normalizeDateString(primaryCompletion);
    if (norm) {
      inferredTimelineDate = addMonthsIso(norm, 6);
      timelineIsEstimated = true;
    }
  }
  return {
    nctId,
    title,
    phases,
    overallStatus,
    primaryCompletionDate: primaryCompletion ? normalizeDateString(primaryCompletion) ?? undefined : undefined,
    pdufaDateFromText,
    inferredTimelineDate,
    timelineIsEstimated,
    url: `https://clinicaltrials.gov/study/${nctId}`,
  };
}
