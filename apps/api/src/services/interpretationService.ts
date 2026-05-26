import { listSignalsByTenant } from "../repositories/signalRepository";

export async function buildDashboardInterpretation(tenantId: string): Promise<{ paragraphs: string[] }> {
  const signals = await listSignalsByTenant(tenantId, 8);

  if (signals.length === 0) {
    return {
      paragraphs: [
        "No monitored signals yet. Connect sources and allow the pipeline to produce intelligence items before interpretation can summarize competitive pressure."
      ]
    };
  }

  const highImportance = signals.filter((s) => s.importanceScore >= 75);
  const types = [...new Set(signals.map((s) => s.signalType))];
  const competitors = [...new Set(signals.map((s) => s.competitorBrand).filter(Boolean))] as string[];

  const p1 =
    highImportance.length > 0
      ? `${highImportance.length} high-importance signal(s) are active. Dominant themes include ${types.slice(0, 4).join(", ")}.`
      : `Recent activity spans ${types.length} signal type(s), led by ${types[0] ?? "general market movement"}.`;

  const p2 =
    competitors.length > 0
      ? `Monitored competitor attention includes: ${competitors.slice(0, 5).join(", ")}.`
      : "Competitor brands are not yet attributed on recent items; consider strengthening entity extraction on ingested content.";

  return { paragraphs: [p1, p2] };
}
