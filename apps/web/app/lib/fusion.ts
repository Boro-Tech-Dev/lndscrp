import type { SignalItem } from "./api";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, max - 1)}…`;
}

/** External column: recent non-internal signal headlines (market-facing). */
export function externalFusionLines(signals: SignalItem[], maxLines = 4): string[] {
  const external = signals.filter((s) => s.signalType !== "internal_performance");
  const lines = external.slice(0, maxLines).map((s) => `${s.signalType.replace(/_/g, " ")}: ${truncate(s.title, 72)}`);
  return lines.length > 0 ? lines : ["No external-class signals in the current window."];
}

/** Internal column: internal_performance signals or placeholder until analytics are connected. */
export function internalFusionLines(signals: SignalItem[], maxLines = 4): string[] {
  const internal = signals.filter((s) => s.signalType === "internal_performance");
  const lines = internal.slice(0, maxLines).map((s) => truncate(s.title, 80));
  if (lines.length > 0) {
    return lines;
  }
  return ["Connect internal analytics to populate performance and engagement signals here."];
}
