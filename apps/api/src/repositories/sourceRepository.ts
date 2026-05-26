import { one, query } from "@landscrape/db";

export interface SourceAssetSummaryRow {
  source_id: string;
  source_name: string;
  source_type: string;
  last_checked_at: string | null;
  last_status: string | null;
  latest_item_at: string | null;
  screenshot_count: number;
  dom_snapshot_count: number;
  latest_screenshot_url: string | null;
  latest_dom_snapshot_url: string | null;
}

export async function listSourcesWithAssets(tenantId: string): Promise<SourceAssetSummaryRow[]> {
  return query<SourceAssetSummaryRow>(`
    SELECT
      s.source_id,
      s.source_name,
      s.source_type,
      s.last_checked_at,
      s.last_status,
      MAX(si.published_at) AS latest_item_at,
      COUNT(sa.source_asset_id) FILTER (WHERE sa.asset_type = 'screenshot')::int AS screenshot_count,
      COUNT(sa.source_asset_id) FILTER (WHERE sa.asset_type = 'dom_snapshot')::int AS dom_snapshot_count,
      MAX(sa.storage_url) FILTER (WHERE sa.asset_type = 'screenshot') AS latest_screenshot_url,
      MAX(sa.storage_url) FILTER (WHERE sa.asset_type = 'dom_snapshot') AS latest_dom_snapshot_url
    FROM sources s
    LEFT JOIN source_items si ON si.source_id = s.source_id
    LEFT JOIN source_assets sa ON sa.source_id = s.source_id
    WHERE s.tenant_id = $1
    GROUP BY s.source_id, s.source_name, s.source_type, s.last_checked_at, s.last_status
    ORDER BY s.source_name
  `, [tenantId]);
}

export interface SourceDetailRow {
  source_id: string;
  tenant_id: string;
  source_group_id: string | null;
  external_id: string | null;
  source_name: string;
  source_type: string;
  base_url: string | null;
  access_notes: string | null;
  is_active: boolean;
  poll_frequency_minutes: number;
  last_checked_at: string | null;
  last_status: string | null;
  source_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getSourceById(tenantId: string, sourceId: string): Promise<SourceDetailRow | null> {
  return one<SourceDetailRow>(
    `SELECT source_id, tenant_id, source_group_id, external_id, source_name, source_type, base_url, access_notes,
            is_active, poll_frequency_minutes, last_checked_at::text, last_status, source_config::jsonb,
            created_at::text, updated_at::text
     FROM sources WHERE tenant_id = $1 AND source_id = $2`,
    [tenantId, sourceId]
  );
}

export async function assertConnectorBelongsToTenant(tenantId: string, connectorId: string): Promise<boolean> {
  const row = await one<{ ok: string }>(
    `SELECT 'ok' AS ok FROM connectors WHERE tenant_id = $1 AND connector_id = $2 AND is_active = TRUE`,
    [tenantId, connectorId]
  );
  return row !== null;
}

export async function insertSource(
  tenantId: string,
  row: {
    source_name: string;
    source_type: string;
    base_url: string | null;
    external_id: string | null;
    source_group_id: string | null;
    access_notes: string | null;
    poll_frequency_minutes: number;
    is_active: boolean;
    source_config: Record<string, unknown>;
  }
): Promise<SourceDetailRow> {
  const inserted = await one<SourceDetailRow>(
    `INSERT INTO sources (
       tenant_id, source_group_id, external_id, source_name, source_type, base_url, access_notes,
       is_active, poll_frequency_minutes, source_config
     ) VALUES ($1, $2, $3, $4, $5::source_type, $6, $7, $8, $9, $10::jsonb)
     RETURNING source_id, tenant_id, source_group_id, external_id, source_name, source_type, base_url, access_notes,
               is_active, poll_frequency_minutes, last_checked_at::text, last_status, source_config::jsonb,
               created_at::text, updated_at::text`,
    [
      tenantId,
      row.source_group_id,
      row.external_id,
      row.source_name,
      row.source_type,
      row.base_url,
      row.access_notes,
      row.is_active,
      row.poll_frequency_minutes,
      JSON.stringify(row.source_config)
    ]
  );
  if (!inserted) throw new Error("insert source failed");
  return inserted;
}

export async function updateSource(
  tenantId: string,
  sourceId: string,
  patch: {
    base_url?: string | null;
    external_id?: string | null;
    access_notes?: string | null;
    poll_frequency_minutes?: number;
    is_active?: boolean;
    source_config?: Record<string, unknown>;
  }
): Promise<SourceDetailRow | null> {
  const existing = await getSourceById(tenantId, sourceId);
  if (!existing) return null;

  const mergedConfig =
    patch.source_config !== undefined
      ? { ...existing.source_config, ...patch.source_config }
      : existing.source_config;

  const nextBaseUrl = patch.base_url !== undefined ? patch.base_url : existing.base_url;
  const nextExternalId = patch.external_id !== undefined ? patch.external_id : existing.external_id;
  const nextNotes = patch.access_notes !== undefined ? patch.access_notes : existing.access_notes;
  const nextPoll = patch.poll_frequency_minutes !== undefined ? patch.poll_frequency_minutes : existing.poll_frequency_minutes;
  const nextActive = patch.is_active !== undefined ? patch.is_active : existing.is_active;

  const row = await one<SourceDetailRow>(
    `UPDATE sources SET
       base_url = $3,
       external_id = $4,
       access_notes = $5,
       poll_frequency_minutes = $6,
       is_active = $7,
       source_config = $8::jsonb,
       updated_at = NOW()
     WHERE tenant_id = $1 AND source_id = $2
     RETURNING source_id, tenant_id, source_group_id, external_id, source_name, source_type, base_url, access_notes,
               is_active, poll_frequency_minutes, last_checked_at::text, last_status, source_config::jsonb,
               created_at::text, updated_at::text`,
    [
      tenantId,
      sourceId,
      nextBaseUrl,
      nextExternalId,
      nextNotes,
      nextPoll,
      nextActive,
      JSON.stringify(mergedConfig)
    ]
  );
  return row;
}
