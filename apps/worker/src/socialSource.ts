import type { SourceRow } from "./ingestTypes";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isXSocialSource(source: Pick<SourceRow, "source_type" | "source_config">): boolean {
  if (source.source_type !== "social") return false;
  const cfg = source.source_config ?? {};
  const provider = typeof cfg.provider === "string" ? cfg.provider.trim().toLowerCase() : "";
  if (provider !== "x") return false;
  const connectorId = typeof cfg.connectorId === "string" ? cfg.connectorId : "";
  return UUID_RE.test(connectorId);
}

export function xSocialConnectorId(source: Pick<SourceRow, "source_config">): string {
  const cfg = source.source_config ?? {};
  return typeof cfg.connectorId === "string" ? cfg.connectorId : "";
}
