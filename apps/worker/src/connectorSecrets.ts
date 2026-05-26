import { getConfig } from "@landscrape/config";
import { decryptJson } from "@landscrape/crypto";
import { one } from "@landscrape/db";

interface ConnectorRow {
  connector_id: string;
  connection_config: Record<string, unknown>;
}

export async function loadConnectorSecrets(
  tenantId: string,
  connectorId: string
): Promise<Record<string, unknown>> {
  const config = getConfig();
  const connector = await one<ConnectorRow>(
    `SELECT connector_id, connection_config FROM connectors WHERE tenant_id = $1 AND connector_id = $2 AND is_active = TRUE`,
    [tenantId, connectorId]
  );
  if (!connector) throw new Error("connector not found");

  const rawCfg = connector.connection_config ?? {};
  let secrets: Record<string, unknown> = {};
  if (typeof rawCfg.encrypted_payload === "string" && rawCfg.encrypted_payload.length > 0 && config.credentialsKey) {
    const dec = decryptJson<Record<string, unknown>>(Buffer.from(rawCfg.encrypted_payload, "base64"), config.credentialsKey);
    if (dec) secrets = dec;
  }
  return { ...rawCfg, ...secrets };
}
