# X (Twitter) social ingestion

LandScrape ingests public X posts into the standard signals pipeline using a **self-hosted XActions stack** (browser/Puppeteer via `xactions-api`) or, for local dev, the in-process HTTP GraphQL scraper. See [x-twitter-xactions.md](x-twitter-xactions.md). Monitoring is **scrape-only** — no auto-like, follow, or post actions.

## Prerequisites

1. `LANDSCRAPE_CREDENTIALS_KEY` set (encrypts connector secrets).
2. Dedicated internal X account (not a personal brand account).
3. Cookie from x.com: DevTools → Application → Cookies → `auth_token` (and `ct0` only if `LANDSCRAPE_X_BACKEND=http`).
4. Docker services: `worker-scheduler`, `worker-social`, `xactions-api` (+ `xactions-postgres`, `xactions-redis`), Postgres, Redis, Ollama.

## Setup checklist

1. Apply schema seeds including [`infra/db/014_x_social_workspace.sql`](../infra/db/014_x_social_workspace.sql) (Ayvakit connector + three sources).
2. Store credentials (never commit tokens):

```bash
export X_AUTH_TOKEN='your_auth_token'
export X_CT0='your_ct0'
export LANDSCRAPE_INTERNAL_API_KEY='...'
export LANDSCRAPE_CREDENTIALS_KEY='...'
chmod +x scripts/configure-x-social-connector.sh
./scripts/configure-x-social-connector.sh
```

3. Start stack: `docker compose up -d xactions-api worker-scheduler worker-social`

## Connector

| Field | Value |
|-------|--------|
| `connector_type` | `social` |
| `connection_config` | `{ "provider": "x" }` |
| `secrets` (encrypted) | `authToken`, `ct0` |

## Source `source_config` schema

| Field | Required | Description |
|-------|----------|-------------|
| `provider` | yes | Must be `"x"` |
| `connectorId` | yes | UUID of social connector |
| `mode` | yes | `search`, `account`, or `hashtag` |
| `query` | if `search` | X search query string |
| `username` | if `account` | Handle without `@` |
| `hashtag` | if `hashtag` | Tag with or without `#` |
| `limit` | no | Default 50, max 200 |
| `filter` | no | `latest` (default) or `top` |
| `includeReplies` | no | Account mode only |

Example — create source via API:

```bash
curl -X POST "http://localhost:4000/v1/tenants/ayvakit/sources" \
  -H "Content-Type: application/json" \
  -H "X-Landscrape-Internal-Key: $LANDSCRAPE_INTERNAL_API_KEY" \
  -d '{
    "source_name": "X Search — avapritinib",
    "source_type": "social",
    "base_url": "https://x.com",
    "poll_frequency_minutes": 120,
    "source_config": {
      "provider": "x",
      "connectorId": "<CONNECTOR_UUID>",
      "mode": "search",
      "query": "avapritinib OR ayvakit",
      "limit": 50,
      "filter": "latest"
    }
  }'
```

## Pipeline

- Scheduler enqueues `social:ingest` for due `source_type = social` sources with `provider: x`.
- `worker-social` fetches tweets, writes `source_items`, runs Ollama summaries, creates `signals` (`social_intelligence`).
- High-engagement posts (likes + retweets ≥ 50) get +15 importance score.

## Agent tool

Research agent exposes `x_search` (`native.x.search`) using the same connector credentials.

## Rate limits and compliance

- Default gap between X HTTP calls: `LANDSCRAPE_X_MIN_GAP_MS=3000`.
- Comply with [X Terms of Service](https://x.com/en/tos); account restrictions are your responsibility.
- Rotate cookies when jobs fail with auth errors.

## Attribution

X monitoring powered by [XActions](https://github.com/nirholas/xactions) (BSL, internal use).
