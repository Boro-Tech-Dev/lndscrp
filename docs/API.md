# API Endpoints

## Authentication

When `AUTH_ENABLED=true`, tenant routes require a Keycloak access token:

```http
Authorization: Bearer <access_token>
```

Obtain a token via the web app login (`POST /api/auth/login` on the Next.js BFF) or Keycloak token endpoint (dev). The JWT must include:

- `realm_access.roles` — e.g. `viewer`, `admin`
- `groups` — workspace groups named `tenant:<slug>` (e.g. `tenant:ayvakit`)

Users with the `admin` role may access any tenant. Others are limited to tenants in their groups.

**Public routes:** `GET /health`, `POST /v1/inbound/webhook/:tenantSlug` (webhook secret).

**Internal automation:** connector/source admin routes still accept `X-Landscrape-Internal-Key`.

## Health

- `GET /health`

## Tenants

- `GET /v1/tenants` — list tenant slugs and display names for workspace switching (filtered by JWT tenant groups)

## Dashboard

- `GET /v1/tenants/:tenantSlug/dashboard`
- `GET /v1/tenants/:tenantSlug/dashboard/interpretation` — deterministic interpretation text from recent signals

## Search

- `GET /v1/tenants/:tenantSlug/search?q=&limit=` — `q` must be at least 2 characters to return hits; shorter queries return empty arrays

## Signals

- `GET /v1/tenants/:tenantSlug/signals?limit=50`
- `GET /v1/tenants/:tenantSlug/signals/:signalId`

## Workspaces

- `GET /v1/tenants/:tenantSlug/competitors` — product tile roster (curated drugs + live enrichment cache)
- `GET /v1/tenants/:tenantSlug/congress`
- `GET /v1/tenants/:tenantSlug/alerts`
- `GET /v1/tenants/:tenantSlug/sources`
- `GET /v1/tenants/:tenantSlug/reports`

## Reports

- `POST /v1/tenants/:tenantSlug/reports/executive-brief`
- `POST /v1/tenants/:tenantSlug/reports/:reportId/export` — body: `{ "format": "pdf" | "pptx" | "markdown_bundle" }`
- `GET /v1/tenants/:tenantSlug/exports/:exportId`

### Example: executive brief

```bash
TOKEN="<access_token from web login session>"
curl -X POST http://localhost:4000/v1/tenants/ayvakit/reports/executive-brief \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Monday Leadership Brief"}'
```

## Connectors & sources (internal key)

- `GET|POST|PATCH /v1/tenants/:tenantSlug/connectors` — header `X-Landscrape-Internal-Key`
- `GET|POST|PATCH /v1/tenants/:tenantSlug/sources` — header `X-Landscrape-Internal-Key`

## Competitors response shape

`GET /v1/tenants/:tenantSlug/competitors` returns:

```json
{
  "tenant": { "tenant_slug": "ayvakit", "display_name": "Ayvakit", ... },
  "products": [
    {
      "productId": "uuid",
      "brandName": "Ayvakit",
      "genericName": "avapritinib",
      "role": "owned",
      "lifecycleStage": "approved",
      "indications": ["SM", "GIST"],
      "pdufaDate": null,
      "approvalDate": "2021-06-01",
      "labelUpdates": [{ "date": "2024-03-15", "title": "...", "url": "...", "source": "DailyMed" }]
    }
  ],
  "workspaceSummary": "Ayvakit workspace tracking 6 competitors across SM and GIST.",
  "actions": ["Generate competitor landscape briefing", "..."]
}
```

Dates use `COALESCE(curated_*, enriched_*)`. PDUFA for pipeline products may be marked estimated when inferred from ClinicalTrials.gov completion dates.

## Admin (requires `admin` or `super_admin` realm role)

- `GET /v1/admin/activity?since=<iso>&limit=<n>` — unified worker/queue/model activity feed (default: last 1 hour, limit 100)
- `POST /v1/admin/tenants/:tenantSlug/ingest/bootstrap` — enqueue ingest jobs for active sources and product enrichment for all roster entries
- `GET /v1/admin/tenants/:tenantSlug/products` — list product roster with enrichment
- `POST /v1/admin/tenants/:tenantSlug/products` — create product (queues enrichment)
- `PATCH /v1/admin/tenants/:tenantSlug/products/:productId` — update product (queues enrichment)
- `DELETE /v1/admin/tenants/:tenantSlug/products/:productId`
- `POST /v1/admin/tenants/:tenantSlug/products/:productId/refresh` — force enrichment job
- `POST /v1/admin/tenants/:tenantSlug/products/bootstrap-enrich` — enqueue enrichment for all products

## Inbound (integration)

- `POST /v1/inbound/webhook/:tenantSlug`

## Manual test checklist

1. Unauthenticated `GET http://localhost:4000/v1/tenants/ayvakit/dashboard` → `401`
2. Sign in at http://localhost:3000/login → dashboard loads
3. `demo@landscrape.local` cannot access an unauthorized tenant slug (e.g. `?tenant=other-brand` redirects to `ayvakit`)
4. Executive brief and report export work when signed in
5. Connector `POST` with `X-Landscrape-Internal-Key` still works
6. `docker compose up` brings Keycloak, web, and API healthy
