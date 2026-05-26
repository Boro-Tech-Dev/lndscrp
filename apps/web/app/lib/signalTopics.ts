import type { SignalType } from "@landscrape/types";

export const ALL_SIGNAL_TYPES: SignalType[] = [
  "competitive_activity",
  "clinical_landscape",
  "congress_intelligence",
  "market_access",
  "regulatory",
  "social_intelligence",
  "professional_discourse",
  "internal_performance"
];

export function parseHideParam(raw: string | string[] | undefined): SignalType[] {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s || typeof s !== "string") return [];
  const allowed = new Set<string>(ALL_SIGNAL_TYPES);
  return s
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is SignalType => allowed.has(t));
}

export function labelForSignalType(t: SignalType): string {
  if (t === "social_intelligence") return "Social";
  return t
    .split("_")
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
}
