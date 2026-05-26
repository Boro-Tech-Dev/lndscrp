# Connectors, sources, and inbound data

This document describes how to wire **connectors**, **sources**, and **search** using the API and environment variables. Mutating routes require the **internal API key** header: `X-Landscrape-Internal-Key` (same value as `LANDSCRAPE_INTERNAL_API_KEY`).

For multi-provider ingestion (PubMed, Europe PMC, ClinicalTrials.gov v2, openFDA, RSS tuning, `news` / `press` types), see [ingest-providers.md](ingest-providers.md).

## Connectors (`connectors` table)

| `connector_type` | Used by | Notes |
|-------------------|---------|--------|
| `email` | IMAP poller ([`apps/worker/src/imapInbound.ts`](../apps/worker/src/imapInbound.ts)) | `connection_config.defaultInboundSourceId` must be the UUID of a `sources` row that receives inbound items. |
| *(any)* | Portal worker ([`apps/worker/src/workers/portalWorker.ts`](../apps/worker/src/workers/portalWorker.ts)) | Referenced by `sources.source_config.connectorId` when `authMode` is `portal`. Store login fields in `secrets` via API (encrypted as `encrypted_payload` when `LANDSCRAPE_CREDENTIALS_KEY` is set). |
| `social` | X/Twitter worker ([`apps/worker/src/workers/socialWorker.ts`](../apps/worker/src/workers/socialWorker.ts)) | `connector_type = social` with encrypted `authToken` + `ct0`. Sources use `source_type = social`, `source_config.provider = x`. See [x-social-ingest.md](x-social-ingest.md). |
| `crm`, `analytics`, `upload`, `other` | **No worker sync yet** | **Future worker contract:** read `connection_config` + optional encrypted secrets; enqueue domain-specific jobs; write `connectors.last_sync_at` on success. |

### Social (X/Twitter)

Implemented. See [x-social-ingest.md](x-social-ingest.md) for connector secrets, source modes (`search`, `account`, `hashtag`), and `scripts/configure-x-social-connector.sh`.

### CRM / analytics / upload / other

These types are **schema-supported** for configuration storage only. Persist OAuth tokens, API base URLs, or vendor metadata in `connection_config` / encrypted `secrets` via `POST/PATCH /v1/tenants/:tenantSlug/connectors`. Implementing vendor-specific sync is a separate effort.

## IMAP inbound checklist

1. Set in `.env`: `LANDSCRAPE_IMAP_HOST`, `LANDSCRAPE_IMAP_PORT` (default 993), `LANDSCRAPE_IMAP_USER`, `LANDSCRAPE_IMAP_PASSWORD`, `LANDSCRAPE_IMAP_TLS` (default true).
2. Create a **target source** (any `source_type` appropriate for `buildSignalDraft` in the inbound worker) via `POST /v1/tenants/:tenantSlug/sources` or SQL.
3. Create an **`email`** connector with `connection_config.defaultInboundSourceId` set to that source’s UUID (`POST /v1/tenants/:tenantSlug/connectors`). See [`infra/db/examples/email_connector.example.sql`](../infra/db/examples/email_connector.example.sql).
4. Run the worker with the **full** role so `startImapInboundPoller` runs ([`apps/worker/src/main.ts`](../apps/worker/src/main.ts)).

## Portal / authenticated sources

1. Create a **portal** connector with `secrets` containing at least `loginUrl`, `username`, `password` (and optional selectors: `userSelector`, `passSelector`, `submitSelector`, `postLoginWaitMs`). Use `LANDSCRAPE_CREDENTIALS_KEY` in production.
2. Create a source with `base_url` pointing at the post-login page, and `source_config`:

```json
{
  "authMode": "portal",
  "connectorId": "<connector UUID>",
  "rendered": true,
  "waitUntil": "networkidle",
  "itemSelector": "...",
  "timeoutMs": 45000
}
```

The scheduler enqueues `portal:ingest` when `authMode === "portal"` and `connectorId` is set ([`apps/worker/src/scheduler.ts`](../apps/worker/src/scheduler.ts)). Playwright runs in the worker container.

## Search modes

`GET /v1/tenants/:tenantSlug/search?q=...&mode=keyword|semantic|hybrid`

- **keyword** (default): `ILIKE` on signal title/summary and report titles (unchanged behavior).
- **semantic**: order signals by pgvector distance on `signals.search_embedding` (Ollama embedding of the query).
- **hybrid**: merge keyword signal hits first, then fill with semantic hits; reports remain keyword-matched.

## Database migrations

Apply in order: `001_landscrape_schema.sql`, `002_worker_platform.sql`, `003_vector_index.sql` (HNSW index for embeddings). The Compose stack mounts the first two on init; add `003` to `compose.yaml` volumes or run manually against existing databases.
