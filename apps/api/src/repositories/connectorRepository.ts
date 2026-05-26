import { encryptJson } from "@landscrape/crypto";
import { one, query } from "@landscrape/db";
import type { AppConfig } from "@landscrape/config";

export type ConnectorType = "crm" | "email" | "analytics" | "social" | "upload" | "other";

export interface ConnectorRow {
  connector_id: string;
  tenant_id: string;
  connector_name: string;
  connector_type: ConnectorType;
  connection_config: Record<string, unknown>;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

function redactConnectionConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out = { ...config };
  if (typeof out.encrypted_payload === "string" && out.encrypted_payload.length > 0) {
    out.encrypted_payload = "[redacted]";
  }
  return out;
}

export async function listConnectors(tenantId: string): Promise<ConnectorRow[]> {
  const rows = await query<ConnectorRow>(
    `SELECT connector_id, tenant_id, connector_name, connector_type, connection_config::jsonb, is_active,
            last_sync_at::text, created_at::text, updated_at::text
     FROM connectors WHERE tenant_id = $1 ORDER BY connector_name`,
    [tenantId]
  );
  return rows.map((r) => ({
    ...r,
    connection_config: redactConnectionConfig(r.connection_config as Record<string, unknown>) as Record<string, unknown>
  }));
}

function assertSocialSecrets(secrets: Record<string, unknown> | undefined, appConfig: AppConfig): void {
  if (!secrets || Object.keys(secrets).length === 0) return;
  const authToken =
    (typeof secrets.authToken === "string" && secrets.authToken) ||
    (typeof secrets.auth_token === "string" && secrets.auth_token) ||
    "";
  const ct0 = typeof secrets.ct0 === "string" ? secrets.ct0 : "";
  if (!authToken) {
    throw new Error("social connector secrets must include authToken (or auth_token)");
  }
  const xBackend = (process.env.LANDSCRAPE_X_BACKEND ?? "api").trim().toLowerCase();
  if (xBackend === "http" && !ct0) {
    throw new Error("social connector secrets must include ct0 when LANDSCRAPE_X_BACKEND=http");
  }
  if (!appConfig.credentialsKey) {
    throw new Error("LANDSCRAPE_CREDENTIALS_KEY is required to store social connector secrets");
  }
}

function buildStoredConfig(
  publicConfig: Record<string, unknown>,
  secrets: Record<string, unknown> | undefined,
  config: AppConfig
): Record<string, unknown> {
  if (!secrets || Object.keys(secrets).length === 0) {
    return { ...publicConfig };
  }
  const buf = encryptJson(secrets, config.credentialsKey);
  if (!buf) {
    throw new Error("LANDSCRAPE_CREDENTIALS_KEY is required to store connector secrets");
  }
  return {
    ...publicConfig,
    encrypted_payload: buf.toString("base64")
  };
}

export async function assertEmailDefaultSource(tenantId: string, sourceId: string): Promise<void> {
  const row = await one<{ ok: string }>(
    `SELECT 'ok' AS ok FROM sources WHERE tenant_id = $1 AND source_id = $2`,
    [tenantId, sourceId]
  );
  if (!row) {
    throw new Error(`defaultInboundSourceId must reference an existing source for this tenant`);
  }
}

export async function insertConnector(
  tenantId: string,
  connectorName: string,
  connectorType: ConnectorType,
  publicConfig: Record<string, unknown>,
  secrets: Record<string, unknown> | undefined,
  appConfig: AppConfig
): Promise<ConnectorRow> {
  if (connectorType === "email") {
    const sid = publicConfig.defaultInboundSourceId;
    if (typeof sid !== "string" || !sid) {
      throw new Error("email connectors require connection_config.defaultInboundSourceId (UUID of an inbound target source)");
    }
    await assertEmailDefaultSource(tenantId, sid);
  }
  if (connectorType === "social") {
    assertSocialSecrets(secrets, appConfig);
  }

  const stored = buildStoredConfig(publicConfig, secrets, appConfig);

  const row = await one<ConnectorRow>(
    `INSERT INTO connectors (tenant_id, connector_name, connector_type, connection_config)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING connector_id, tenant_id, connector_name, connector_type, connection_config::jsonb, is_active,
               last_sync_at::text, created_at::text, updated_at::text`,
    [tenantId, connectorName, connectorType, JSON.stringify(stored)]
  );
  if (!row) throw new Error("insert connector failed");
  return {
    ...row,
    connection_config: redactConnectionConfig(row.connection_config as Record<string, unknown>) as Record<string, unknown>
  };
}

export async function updateConnector(
  tenantId: string,
  connectorId: string,
  patch: {
    connector_name?: string;
    is_active?: boolean;
    connection_config?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
  },
  appConfig: AppConfig
): Promise<ConnectorRow | null> {
  const existing = await one<{ connection_config: Record<string, unknown> }>(
    `SELECT connection_config::jsonb AS connection_config FROM connectors WHERE tenant_id = $1 AND connector_id = $2`,
    [tenantId, connectorId]
  );
  if (!existing) return null;

  let nextConfig = { ...(existing.connection_config ?? {}) };
  if (patch.connection_config) {
    nextConfig = { ...nextConfig, ...patch.connection_config };
  }

  if (patch.secrets && Object.keys(patch.secrets).length > 0) {
    const buf = encryptJson(patch.secrets, appConfig.credentialsKey);
    if (!buf) {
      throw new Error("LANDSCRAPE_CREDENTIALS_KEY is required to store connector secrets");
    }
    nextConfig = { ...nextConfig, encrypted_payload: buf.toString("base64") };
  }

  const typeRow = await one<{ connector_type: ConnectorType }>(
    `SELECT connector_type FROM connectors WHERE tenant_id = $1 AND connector_id = $2`,
    [tenantId, connectorId]
  );
  if (typeRow?.connector_type === "email" && nextConfig.defaultInboundSourceId) {
    await assertEmailDefaultSource(tenantId, String(nextConfig.defaultInboundSourceId));
  }
  if (typeRow?.connector_type === "social" && patch.secrets) {
    assertSocialSecrets(patch.secrets, appConfig);
  }

  const row = await one<ConnectorRow>(
    `UPDATE connectors SET
       connector_name = COALESCE($4, connector_name),
       is_active = COALESCE($5, is_active),
       connection_config = $3::jsonb,
       updated_at = NOW()
     WHERE tenant_id = $1 AND connector_id = $2
     RETURNING connector_id, tenant_id, connector_name, connector_type, connection_config::jsonb, is_active,
               last_sync_at::text, created_at::text, updated_at::text`,
    [
      tenantId,
      connectorId,
      JSON.stringify(nextConfig),
      patch.connector_name ?? null,
      patch.is_active ?? null
    ]
  );
  if (!row) return null;
  return {
    ...row,
    connection_config: redactConnectionConfig(row.connection_config as Record<string, unknown>) as Record<string, unknown>
  };
}
