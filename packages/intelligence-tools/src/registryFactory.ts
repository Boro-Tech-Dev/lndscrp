import { getConfig } from "@landscrape/config";
import { createClinicalReferenceKitPool } from "@landscrape/mcp-client";
import { createDefaultRegistry, type ReferenceToolsMode, type ToolRegistry } from "./registry";

export interface RegistryBootstrap {
  registry: ToolRegistry;
  referenceMode: ReferenceToolsMode;
  sidecarCount: number;
}

export async function bootstrapRegistry(): Promise<RegistryBootstrap> {
  const config = getConfig();
  const pool = createClinicalReferenceKitPool({
    fda: config.mcpFdaUrl,
    pubmed: config.mcpPubmedUrl,
    clinicaltrials: config.mcpClinicaltrialsUrl,
  });

  const configuredUrls = [config.mcpFdaUrl, config.mcpPubmedUrl, config.mcpClinicaltrialsUrl].filter(Boolean);
  let mcpConnected = false;

  if (configuredUrls.length > 0 && config.referenceTools !== "native") {
    try {
      await pool.connectAll();
      mcpConnected = pool.callers().length === configuredUrls.length;
    } catch {
      mcpConnected = false;
    }
  }

  let referenceMode: ReferenceToolsMode;
  if (config.referenceTools === "native") {
    referenceMode = "native";
  } else if (config.referenceTools === "mcp") {
    referenceMode = mcpConnected ? "mcp" : "native";
  } else {
    referenceMode = mcpConnected ? "mcp" : "native";
  }

  const registry = createDefaultRegistry({
    mode: referenceMode,
    mcpCallers: referenceMode === "mcp" ? pool.callers() : [],
  });

  return {
    registry,
    referenceMode,
    sidecarCount: referenceMode === "mcp" ? pool.callers().length : 0,
  };
}

export function pubmedToolId(mode: ReferenceToolsMode): string {
  return mode === "mcp" ? "mcp.pubmed.search" : "native.pubmed.search";
}

export function fdaToolId(mode: ReferenceToolsMode): string {
  return mode === "mcp" ? "mcp.fda.search" : "native.openfda.search";
}
