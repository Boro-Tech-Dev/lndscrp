import { query, one } from "@landscrape/db";

export type CongressPriority = "imminent" | "pivotal" | "expected" | "watch";

export interface CongressEventBrandRow {
  brandName: string;
  role: "owned" | "competitor";
  presence: "confirmed" | "expected";
}

export interface CongressHeadlineSessionRow {
  title: string;
  brandName: string;
  startsAt: string;
  endsAt?: string;
  sessionLabel?: string;
  abstractId?: string;
  url?: string;
}

export interface CongressEventRow {
  event_id: string;
  tenant_id: string;
  event_slug: string;
  acronym: string;
  name: string;
  location: string;
  timezone: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
  focus_tags: string[];
  priority: CongressPriority;
  summary: string;
  brands: CongressEventBrandRow[];
  headline_sessions: CongressHeadlineSessionRow[];
  program_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCongressEventInput {
  event_slug: string;
  acronym: string;
  name: string;
  location: string;
  timezone: string;
  starts_at: string;
  ends_at: string;
  sort_order?: number;
  focus_tags?: string[];
  priority?: CongressPriority;
  summary?: string;
  brands?: CongressEventBrandRow[];
  headline_sessions?: CongressHeadlineSessionRow[];
  program_url?: string | null;
}

export type PatchCongressEventInput = Partial<CreateCongressEventInput>;

function parseBrands(raw: unknown): CongressEventBrandRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object")
    .map((b): CongressEventBrandRow => ({
      brandName: String(b.brandName ?? ""),
      role: b.role === "owned" ? "owned" : "competitor",
      presence: b.presence === "confirmed" ? "confirmed" : "expected",
    }))
    .filter((b) => b.brandName.length > 0);
}

function parseHeadlineSessions(raw: unknown): CongressHeadlineSessionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s != null && typeof s === "object")
    .map((s) => ({
      title: String(s.title ?? ""),
      brandName: String(s.brandName ?? ""),
      startsAt: String(s.startsAt ?? ""),
      endsAt: s.endsAt != null ? String(s.endsAt) : undefined,
      sessionLabel: s.sessionLabel != null ? String(s.sessionLabel) : undefined,
      abstractId: s.abstractId != null ? String(s.abstractId) : undefined,
      url: s.url != null ? String(s.url) : undefined,
    }))
    .filter((s) => s.title.length > 0 && s.startsAt.length > 0);
}

function mapCongressEventRow(row: Record<string, unknown>): CongressEventRow {
  return {
    event_id: String(row.event_id),
    tenant_id: String(row.tenant_id),
    event_slug: String(row.event_slug),
    acronym: String(row.acronym),
    name: String(row.name),
    location: String(row.location),
    timezone: String(row.timezone),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    sort_order: Number(row.sort_order ?? 0),
    focus_tags: Array.isArray(row.focus_tags) ? row.focus_tags.map(String) : [],
    priority: row.priority as CongressPriority,
    summary: String(row.summary ?? ""),
    brands: parseBrands(row.brands),
    headline_sessions: parseHeadlineSessions(row.headline_sessions),
    program_url: row.program_url != null ? String(row.program_url) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listCongressEvents(tenantId: string): Promise<CongressEventRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT * FROM workspace_congress_events
    WHERE tenant_id = $1
    ORDER BY starts_at ASC, sort_order ASC
    `,
    [tenantId]
  );
  return rows.map(mapCongressEventRow);
}

export async function getCongressEventById(
  tenantId: string,
  eventId: string
): Promise<CongressEventRow | null> {
  const row = await one<Record<string, unknown>>(
    `SELECT * FROM workspace_congress_events WHERE tenant_id = $1 AND event_id = $2`,
    [tenantId, eventId]
  );
  return row ? mapCongressEventRow(row) : null;
}

export async function insertCongressEvent(
  tenantId: string,
  input: CreateCongressEventInput
): Promise<CongressEventRow> {
  const rows = await query<Record<string, unknown>>(
    `
    INSERT INTO workspace_congress_events (
      tenant_id, event_slug, acronym, name, location, timezone,
      starts_at, ends_at, sort_order, focus_tags, priority, summary,
      brands, headline_sessions, program_url
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9, $10,
      $11::congress_priority, $12, $13::jsonb, $14::jsonb, $15
    )
    RETURNING *
    `,
    [
      tenantId,
      input.event_slug,
      input.acronym,
      input.name,
      input.location,
      input.timezone,
      input.starts_at,
      input.ends_at,
      input.sort_order ?? 99,
      input.focus_tags ?? [],
      input.priority ?? "expected",
      input.summary ?? "",
      JSON.stringify(input.brands ?? []),
      JSON.stringify(input.headline_sessions ?? []),
      input.program_url ?? null,
    ]
  );
  return mapCongressEventRow(rows[0]!);
}

export async function patchCongressEvent(
  tenantId: string,
  eventId: string,
  input: PatchCongressEventInput
): Promise<CongressEventRow | null> {
  const existing = await getCongressEventById(tenantId, eventId);
  if (!existing) return null;

  const merged: CreateCongressEventInput = {
    event_slug: input.event_slug ?? existing.event_slug,
    acronym: input.acronym ?? existing.acronym,
    name: input.name ?? existing.name,
    location: input.location ?? existing.location,
    timezone: input.timezone ?? existing.timezone,
    starts_at: input.starts_at ?? existing.starts_at,
    ends_at: input.ends_at ?? existing.ends_at,
    sort_order: input.sort_order ?? existing.sort_order,
    focus_tags: input.focus_tags ?? existing.focus_tags,
    priority: input.priority ?? existing.priority,
    summary: input.summary ?? existing.summary,
    brands: input.brands ?? existing.brands,
    headline_sessions: input.headline_sessions ?? existing.headline_sessions,
    program_url: input.program_url !== undefined ? input.program_url : existing.program_url,
  };

  const rows = await query<Record<string, unknown>>(
    `
    UPDATE workspace_congress_events SET
      event_slug = $3,
      acronym = $4,
      name = $5,
      location = $6,
      timezone = $7,
      starts_at = $8::timestamptz,
      ends_at = $9::timestamptz,
      sort_order = $10,
      focus_tags = $11,
      priority = $12::congress_priority,
      summary = $13,
      brands = $14::jsonb,
      headline_sessions = $15::jsonb,
      program_url = $16,
      updated_at = NOW()
    WHERE tenant_id = $1 AND event_id = $2
    RETURNING *
    `,
    [
      tenantId,
      eventId,
      merged.event_slug,
      merged.acronym,
      merged.name,
      merged.location,
      merged.timezone,
      merged.starts_at,
      merged.ends_at,
      merged.sort_order ?? 0,
      merged.focus_tags ?? [],
      merged.priority ?? "expected",
      merged.summary ?? "",
      JSON.stringify(merged.brands ?? []),
      JSON.stringify(merged.headline_sessions ?? []),
      merged.program_url ?? null,
    ]
  );
  return rows[0] ? mapCongressEventRow(rows[0]) : null;
}

export async function deleteCongressEvent(tenantId: string, eventId: string): Promise<boolean> {
  const rows = await query<{ event_id: string }>(
    `DELETE FROM workspace_congress_events WHERE tenant_id = $1 AND event_id = $2 RETURNING event_id`,
    [tenantId, eventId]
  );
  return rows.length > 0;
}
