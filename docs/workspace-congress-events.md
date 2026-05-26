# Workspace congress events

Each pharma workspace can define a **curated congress roster**: upcoming meetings with dates, competitive presence, and headline sessions. The Congress war room page renders these as tiles with live countdowns to conference start.

## Database

- `workspace_congress_events` — curated baseline per tenant (see `infra/db/013_workspace_congress_events.sql`)

Apply schema and seed:

```bash
psql $DATABASE_URL -f infra/db/013_workspace_congress_events.sql
```

Or run full `npm run db:schema` (includes `013` after `012_workspace_products.sql`).

## Ayvakit default roster

Five events seeded in chronological order: ASCO 2026, EHA 2026, EAACI 2026, EADV 2026, ASH 2026.

## API

### Tenant (authenticated)

- `GET /v1/tenants/:tenantSlug/congress` — returns `events[]` plus existing `timeline`, `eventState`, `themes`, `outputs`.

### Admin CRUD

All routes require admin auth (same as product roster).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/admin/tenants/:slug/congress-events` | List events |
| POST | `/v1/admin/tenants/:slug/congress-events` | Create event |
| PATCH | `/v1/admin/tenants/:slug/congress-events/:eventId` | Update event |
| DELETE | `/v1/admin/tenants/:slug/congress-events/:eventId` | Delete event |

**Create body example:**

```json
{
  "event_slug": "asco-2027",
  "acronym": "ASCO",
  "name": "ASCO Annual Meeting 2027",
  "location": "Chicago, IL",
  "timezone": "America/Chicago",
  "starts_at": "2027-05-28T08:00:00-05:00",
  "ends_at": "2027-06-01T18:00:00-05:00",
  "sort_order": 0,
  "focus_tags": ["GIST", "SM"],
  "priority": "expected",
  "summary": "Optional competitive context.",
  "brands": [{ "brandName": "Ayvakit", "role": "owned", "presence": "expected" }],
  "headline_sessions": [],
  "program_url": "https://www.asco.org/annual-meeting/"
}
```

`priority` is one of: `imminent`, `pivotal`, `expected`, `watch`.

## New tenant template

1. Add tenant in `tenants` (or extend an `NNN_<slug>_workspace.sql` seed file).
2. Insert `workspace_congress_events` rows with unique `event_slug` per tenant.
3. Congress page countdown uses `starts_at` as the conference start target.

## Admin UI

REST CRUD is available now. A dedicated admin UI page (mirroring Product roster) is deferred.
