# LandScrape Monorepo

LandScrape is a modular-monolith market intelligence platform with:
- a **Next.js web app** for client-facing dashboards
- a **Next.js admin app** for tenant/source administration
- an **Express API** for signals, dashboards, reports, approvals, and health
- a **Node worker** for ingestion, classification, and signal generation
- a **shared PostgreSQL schema** with pgvector support
- a **production Docker Compose stack** including Postgres, Redis, MinIO, Ollama, Keycloak, API, worker, web, and admin

See [docs/connectors-and-sources.md](docs/connectors-and-sources.md) for **connectors**, **IMAP**, **portal sources**, **search modes** (`keyword` / `semantic` / `hybrid`), and the **future connector** contract for CRM/analytics/social.

## Monorepo layout

```text
apps/
  api/
  worker/
  web/
  admin/
packages/
  config/
  types/
  db/
  ai/
infra/
  docker/
  db/
```

## Quick start

### Local development
```bash
npm install
npm run db:schema
npm run dev:api
npm run dev:worker
npm run dev:web
npm run dev -w @landscrape/web
# Admin console: http://localhost:3000/admin
```

### Production stack
```bash
cp .env.example .env
docker compose up -d --build
```

With Compose running, open **http://localhost:3000** (web), **http://localhost:3001** (admin), **http://localhost:8080** (Keycloak), and **http://localhost:4000** (API).

#### Authentication (Keycloak)

When `AUTH_ENABLED=true` (default in `.env.example`), the stack starts **Keycloak** with the `landscrape` realm imported from `infra/keycloak/landscrape-realm.json`.

**Embedded login:** the web and admin apps show a LandScrape-branded sign-in form (no redirect to Keycloak UI). The Next.js BFF exchanges credentials server-side and stores httpOnly session cookies.

**Seed users (dev only):**

| User | Password | Role | Tenants |
|------|----------|------|---------|
| `demo@landscrape.local` | `demo` | viewer | `ayvakit` |
| `admin@landscrape.local` | `admin` | admin | `ayvakit` (admin role can access any tenant) |

**Add a user:** Keycloak Admin Console at http://localhost:8080 (master admin: see `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` in `.env`) → realm **landscrape** → Users → Create → Credentials → join groups named `tenant:<slug>` (e.g. `tenant:ayvakit`).

Fresh Postgres volumes seed the **Ayvakit** workspace automatically via `infra/db/011_ayvakit_workspace.sql`, the product roster via `infra/db/012_workspace_products.sql`, and congress events via `infra/db/013_workspace_congress_events.sql` (mounted in Docker Compose init). See [docs/workspace-congress-events.md](docs/workspace-congress-events.md). To reset everything:

```bash
docker compose down -v
docker compose up --build
```

Default workspace slug is `ayvakit` (`LANDSCRAPE_TENANT_SLUG` in `.env` for legacy worker profile).

Set `AUTH_ENABLED=false` to disable JWT enforcement (legacy open API behavior).

**Note:** Direct Access Grant (password flow) is enabled for the embedded login BFF in v1. Disable it in production and move to Authorization Code + PKCE when hardening.

#### First boot (Ollama model pull)

The `ollama-init` service runs once on first boot to `ollama pull $OLLAMA_MODEL` (default `llama3.2:3b`, ~2.0 GB on disk, ~2.6 GiB at load time). Workers that call Ollama (`worker-ingest`, `worker-embed`, `worker-inbound`, `worker-portal`, and the optional `worker-full` monolith profile) wait for `ollama-init` to exit successfully before starting (`depends_on: ollama-init: condition: service_completed_successfully`). Workers that do not use Ollama (`worker-scheduler`, `worker-export`, `worker-reconcile`, `worker-enrich`) start as soon as Postgres and Redis are ready. Subsequent boots reuse the cached model via the `ollama_data` Docker volume.

If you change `OLLAMA_MODEL` to a larger model (e.g. `llama3.1:8b` needs ~4.8 GiB at load), ensure Docker Desktop has at least 8 GiB of memory allocated, otherwise Ollama-consuming workers will crash on the first `generateSummary` call with `model requires more system memory`. That crash is intentional — there are no AI fallbacks.

Watch progress with `docker compose logs -f ollama-init`. When it exits 0, Ollama-dependent workers should log `[ollama] model '<model>' verified at http://ollama:11434`. The scheduler logs `[scheduler]` ticks; the export worker logs `[worker] export:report listening`.

#### Reseed from scratch

The seed SQL in `infra/db/` runs only on a fresh Postgres volume. To re-apply seeds after schema changes:

```bash
docker compose down -v
rm -rf postgres_data   # only if you have a bind-mounted data directory; safe no-op otherwise
docker compose up --build
```

This also resets MinIO artifacts and Ollama's model cache. If you want to preserve the Ollama model, run `docker compose down` (without `-v`) and only reset Postgres with `docker compose rm -fsv postgres && docker volume rm $(basename $(pwd))_postgres_data`.

## Important environment variables

See `.env.example` for the full list. Every variable listed there is **required**: the worker's config loader calls `requireEnv()` and will crash at startup with `Missing required environment variable: <NAME>` if any is missing.

Key new variables:

- `LANDSCRAPE_CONTACT_EMAIL` and `LANDSCRAPE_CONTACT_URL` are advertised in the `User-Agent` and `From` headers sent by every worker HTTP request so site owners have a real contact path. No placeholder, no `localhost`: use a real email and a real reachable URL.
- `OLLAMA_MODEL` drives the `ollama-init` pull and the hard precondition check on Ollama-consuming worker roles; if the model isn't present under that exact tag, those workers crash before processing jobs.

## Ingestion behavior (hard failures only)

The ingestion pipeline is deliberately intolerant of bad data:

- **No silent fallbacks.** Missing titles, summaries, or publication dates in source payloads raise `Error` with source + field context.
- **No swallowed errors.** If a source fails, the whole cycle fails and the worker exits non-zero; compose restarts it.
- **AI summaries are mandatory.** `generateSummary` throws on non-200 Ollama responses or empty completions. There is no template fallback.
- **Required env vars crash fast.** `requireEnv()` in `packages/config` throws if any required variable is missing or empty at startup.
- **Polite HTTP.** All outbound requests from the worker go through `politeFetch`: real contact identity in UA/From, per-host 5s minimum gap plus 0-2 s jitter, exponential backoff honoring `Retry-After` on 429/5xx, and conditional GET (`If-None-Match` / `If-Modified-Since`) for RSS/JSON feeds. On 304 the source is skipped, logged as `status=not_modified`.
- **Startup probe.** On boot the worker does a `[probe]` request per source and logs status so broken URLs are obvious before a cycle begins.

## Services

- **web**: client-facing dashboard
- **admin**: agency-side admin console
- **api**: core business API
- **worker-scheduler**: enqueues due source ingest jobs (every 60s)
- **worker-ingest**: consumes ingest jobs, fetches sources, creates signals
- **worker-export**: renders report PDF/MD exports to MinIO
- **worker-social**: X/Twitter ingest via XActions HTTP scraper ([docs/x-social-ingest.md](docs/x-social-ingest.md))
- **worker-embed**, **worker-enrich**, **worker-portal**, **worker-inbound**, **worker-reconcile**: embedding backfill, signal enrichment, portal sources, email inbound, stale-source audit
- **postgres**: primary data store
- **redis**: caching and future queueing
- **minio**: object storage for documents and exports
- **keycloak**: identity provider (realm `landscrape`)
- **ollama**: local model runtime (ingest summaries + optional agent)
- **agent**: research assistant and agent-backed briefs/enrichment
- **mcp-fda / mcp-pubmed / mcp-clinicaltrials**: MCP sidecars for clinical reference tools

See [docs/mcp-clinical-reference-kit.md](docs/mcp-clinical-reference-kit.md) for agent/MCP configuration.

### VPS deployment (deliver-impact.com)

Full runbook: **[docs/deploy-vps.md](docs/deploy-vps.md)**. Template: **`.env.vps.example`**.

1. **Swap:** `bash infra/vps/setup-swap.sh` on the VPS (16 GB) before compose.
2. Copy **`.env.vps.example`** to `.env` and rotate all `CHANGE_ME_*` secrets.
3. **RAM:** 8 GB + 16 GB swap for full stack with `llama3.2:3b`; use `AGENT_INFERENCE_BACKEND=openai_compat` to offload agent inference.
4. Expose **web only** via Traefik (`compose.traefik.yml`); API stays internal (`API_INTERNAL_URL=http://api:4000`).
5. Start with `COMPOSE_PARALLEL_LIMIT=2` and `COMPOSE_FILE=compose.yaml:compose.vps.yml:compose.traefik.yml docker compose up -d --build`.
6. Shared images (`landscrape-worker:prod`, etc.) build once per role — see deploy doc.

### Adding sources (engineers)

Mutating routes require header `X-Landscrape-Internal-Key: <LANDSCRAPE_INTERNAL_API_KEY>`. See [docs/connectors-and-sources.md](docs/connectors-and-sources.md) and [docs/ingest-providers.md](docs/ingest-providers.md).

```bash
curl -X POST "http://localhost:4000/v1/tenants/ayvakit/sources" \
  -H "Content-Type: application/json" \
  -H "X-Landscrape-Internal-Key: $LANDSCRAPE_INTERNAL_API_KEY" \
  -d '{
    "source_name": "PubMed avapritinib SM",
    "source_type": "publication",
    "base_url": "https://eutils.ncbi.nlm.nih.gov",
    "source_config": {
      "provider": "pubmed",
      "query": "avapritinib OR ayvakit OR mastocytosis",
      "retmax": 10
    }
  }'
```

## Notes

This repository is intentionally implementation-oriented. It includes:
- a real schema SQL file
- runnable TypeScript services
- HTTP endpoints wired to the database
- a worker pipeline that upserts demo-source checks into signals
- container definitions and a production-grade compose topology

It does **not** include:
- full third-party source adapters for every real-world data provider
- SAML/SSO per tenant
- hardened secret rotation workflows
- multi-region deployment automation

Those are straightforward next steps once this baseline is accepted.


## Source-specific ingestion adapters

Routing is provider-based (see [docs/ingest-providers.md](docs/ingest-providers.md)). The worker includes adapters for the major LandScrape intelligence domains:

- **PubMed / literature** via NCBI E-utilities `esearch` + `esummary` (optional `includeAbstract` + `efetch`), plus **Europe PMC** when `source_config.provider` is `europepmc`
- **Competitor site change detection** via page snapshot fetch, normalized content extraction, and content-hash diffing
- **Congress / trials** via RSS/Atom, JSON, HTML, **ClinicalTrials.gov API v2** (`provider: clinicaltrials_v2` or query fields), or Playwright
- **FDA / regulatory** via RSS, JSON, HTML, or **openFDA** (`provider: openfda`)
- **Payer / formulary sources** via RSS or keyword-focused HTML extraction
- **X (Twitter) social** via XActions HTTP scraper and `worker-social` ([docs/x-social-ingest.md](docs/x-social-ingest.md))

### Source configuration

Each source can carry adapter-specific options in `sources.source_config`, for example:

```json
{
  "query": "bezuclastinib OR avapritinib OR mastocytosis OR GIST",
  "retmax": 15,
  "competitorBrand": "Ayvakit",
  "diseaseState": "Systemic Mastocytosis",
  "marketRegion": "US",
  "format": "xml"
}
```

### Important note

These are real source-specific adapters and persistence flows, but they are still a first-pass implementation. They do not yet include:

- authenticated portal handling
- JavaScript-rendered browser automation
- deep DOM diffing with selector policies
- PDF pipeline integration (PubMed abstracts can be prefetched via `includeAbstract` on publication sources)
- provider-specific rate-limit backoff profiles


## Playwright-based rendered page ingestion

Competitor site and congress adapters now support **rendered-page ingestion** using Playwright + Chromium. This allows LandScrape to capture pages that depend on client-side JavaScript before extracting signals.

### Supported rendered ingestion controls

Set these values in `sources.source_config` when a source needs browser rendering:

```json
{
  "rendered": true,
  "renderMode": "playwright",
  "waitUntil": "networkidle",
  "waitForSelector": ".agenda-list",
  "additionalWaitMs": 1500,
  "itemSelector": ".agenda-item",
  "titleSelector": "h3",
  "summarySelector": ".abstract, p",
  "linkSelector": "a[href]",
  "maxItems": 12
}
```

### Typical usage

- **Competitor site change detection**: render the page, normalize the post-JS DOM, then diff and persist snapshot content.
- **Congress portals**: wait for agenda or abstract containers, extract repeated session nodes, and emit one source item per rendered session card.

### Container requirements

The worker now runs on a Playwright-compatible image and requests extra shared memory in Docker Compose to make Chromium-based extraction more stable.


## Visual audit artifacts

Rendered competitor-site and congress-source checks now persist full-page PNG screenshots and HTML DOM snapshots to MinIO-compatible object storage. Configure storage with `STORAGE_*` environment variables; by default the production compose stack uses the bundled `minio` service.
