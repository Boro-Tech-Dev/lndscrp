import {
  bootstrapRegistry,
  fdaToolId,
  pubmedToolId,
  type RegistryBootstrap,
} from "./registryFactory";
import type { ToolRegistry } from "./registry";

let registryPromise: Promise<RegistryBootstrap> | null = null;

export async function getSharedRegistry(): Promise<ToolRegistry> {
  const boot = await getRegistryBootstrap();
  return boot.registry;
}

export async function getRegistryBootstrap(): Promise<RegistryBootstrap> {
  if (!registryPromise) {
    registryPromise = bootstrapRegistry();
  }
  return registryPromise;
}

export async function runBoundedEnrichment(
  tenantId: string,
  signalId: string,
  title: string,
  summary: string
): Promise<Record<string, unknown>> {
  const boot = await getRegistryBootstrap();
  const registry = boot.registry;
  const ctx = { tenantId, signalId, mode: "ingest_enrich" as const };
  const topic = `${title} ${summary}`.slice(0, 500);
  const enrichment: Record<string, unknown> = {
    topic,
    enrichedAt: new Date().toISOString(),
    referenceTools: boot.referenceMode,
  };

  try {
    const pubmed = await registry.execute(
      pubmedToolId(boot.referenceMode),
      { query: topic.slice(0, 200), retmax: 3 },
      ctx
    );
    enrichment.pubmed = pubmed.data;
  } catch (e) {
    enrichment.pubmedError = String(e);
  }

  try {
    const fda = await registry.execute(
      fdaToolId(boot.referenceMode),
      { search: title.split(/\s+/).slice(0, 3).join(" "), limit: 3 },
      ctx
    );
    enrichment.openfda = fda.data;
  } catch (e) {
    enrichment.openfdaError = String(e);
  }

  return enrichment;
}
