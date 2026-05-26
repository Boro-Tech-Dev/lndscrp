# Ingestion providers

Worker routing lives in [`apps/worker/src/providers/router.ts`](../apps/worker/src/providers/router.ts). Use `source_config.provider` to select implementations where multiple backends share a `source_type`.

## Publication

| `provider` | Behavior |
|------------|----------|
| *(default)* | PubMed `esearch` + `esummary`; optional `includeAbstract: true` batches `efetch` XML for abstracts (NCBI rate limits apply). Set `NCBI_API_KEY` and optional `LANDSCRAPE_EUTILS_MIN_GAP_MS`. |
| `europepmc` | Europe PMC REST search; requires `epmcQuery` or `query`. |

## Congress

| `provider` / config | Behavior |
|---------------------|----------|
| `clinicaltrials_v2` | ClinicalTrials.gov API v2; `base_url` optional if `query.cond`, `query.term`, `query.intr`, etc. are set. |
| *(legacy)* | Prior behavior: pasted JSON/RSS/HTML URLs, Playwright when configured. |

## Regulatory

| `provider` | Behavior |
|------------|----------|
| `openfda` | `openfdaEndpoint` (e.g. `drug/enforcement.json`), `openfdaSearch`, `openfdaLimit`; optional `OPENFDA_API_KEY` or `source_config.openfdaApiKey`. `base_url` optional when using this provider. |
| *(legacy)* | RSS, generic JSON `results`/`items`, or HTML snapshot. |

## RSS volume

RSS paths use [`parseRssFeed`](../apps/worker/src/providers/rss.ts) with `source_config.maxItems` / `rssMaxItems` (default 50) and `rssDedupe` (default dedupe on).

## News / press

`source_type` **`news`** and **`press`** require `base_url` (RSS or HTML). Signals map to `professional_discourse` with entity `ingest_channel`.

## Social

`source_type` **`social`** (X/Twitter) signals map to `social_intelligence`. The ingest pipeline also tags `signal_entities` with `ingest_channel=social`.

## PDFs and long-form artifacts

Full PDF extraction and richer `source_assets` types are tracked in the [multi-worker platform plan](multi-worker_platform_rollout_b208231b.plan.md). PubMed `includeAbstract` is the lightweight on-ramp for longer text without that pipeline.
