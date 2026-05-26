import { query } from "@landscrape/db";

export interface CongressEventRow {
  slot: string;
  session: string;
  takeaway: string;
}

export interface ThemeRow {
  label: string;
}

export async function listCongressTimeline(tenantId: string): Promise<CongressEventRow[]> {
  return query<CongressEventRow>(
    `
    SELECT
      TO_CHAR(created_at AT TIME ZONE 'UTC', 'HH24:MI') AS slot,
      title AS session,
      summary AS takeaway
    FROM signals
    WHERE tenant_id = $1
      AND signal_type = 'congress_intelligence'
    ORDER BY created_at DESC
    LIMIT 8
    `,
    [tenantId]
  );
}

export async function listCongressThemes(tenantId: string): Promise<ThemeRow[]> {
  return query<ThemeRow>(
    `
    SELECT DISTINCT COALESCE(entity_value, competitor_brand, disease_state, 'Unclassified Theme') AS label
    FROM signals s
    LEFT JOIN signal_entities se ON se.signal_id = s.signal_id
    WHERE s.tenant_id = $1
      AND s.signal_type = 'congress_intelligence'
    LIMIT 6
    `,
    [tenantId]
  );
}
