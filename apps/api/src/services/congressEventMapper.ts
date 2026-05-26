import type { WorkspaceCongressEvent } from "@landscrape/types";
import type { CongressEventRow } from "../repositories/congressEventRepository";

export function mapCongressEventToTile(row: CongressEventRow): WorkspaceCongressEvent {
  return {
    eventId: row.event_id,
    eventSlug: row.event_slug,
    acronym: row.acronym,
    name: row.name,
    location: row.location,
    timezone: row.timezone,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    sortOrder: row.sort_order,
    focusTags: row.focus_tags,
    priority: row.priority,
    summary: row.summary,
    brands: row.brands.map((b) => ({
      brandName: b.brandName,
      role: b.role,
      presence: b.presence,
    })),
    headlineSessions: row.headline_sessions.map((s) => ({
      title: s.title,
      brandName: s.brandName,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      sessionLabel: s.sessionLabel,
      abstractId: s.abstractId,
      url: s.url,
    })),
    programUrl: row.program_url,
  };
}
