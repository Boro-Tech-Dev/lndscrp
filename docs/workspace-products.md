# Workspace product roster

Each pharma workspace defines a **product roster**: one owned brand plus tracked competitors. The Competitors page renders this roster as tiles (not signal-derived rows).

## Database

- `workspace_products` — curated baseline (brand, generic, class, indications, lifecycle, URLs, optional curated dates)
- `workspace_product_enrichment` — cached live data from ClinicalTrials.gov, openFDA, and DailyMed (refreshed every 24h by the worker)

Apply schema and seed:

```bash
psql $DATABASE_URL -f infra/db/012_workspace_products.sql
```

Or run full `npm run db:schema` (includes `012` after `011_ayvakit_workspace.sql`).

## New tenant template

1. Add tenant in `tenants` (or extend an `NNN_<slug>_workspace.sql` seed file).
2. Insert `workspace_products` rows: one `owned`, competitors with `sort_order`, HCP/DTC/label URLs.
3. Align `sources` with `source_config.competitorBrand` and `channel` (`hcp` / `dtc`) for ingest monitoring.
4. Run `POST /v1/admin/tenants/:slug/products/bootstrap-enrich` (or ingest bootstrap, which also queues product enrichment).

## Ayvakit default roster

| Brand | Role | Lifecycle |
|-------|------|-----------|
| Ayvakit | owned | approved |
| Bezuclastinib | competitor | pipeline |
| Rydapt, Qinlock, Gleevec, Sutent, Stivarga | competitor | approved / generic |

## Admin UI

Internal admin app: **Product roster** (`/products` on port 3001). Edit curated fields and trigger enrichment refresh.

## Worker

- Queue: `enrich:product`
- Role: included in `full` and `enrich` worker roles; dedicated `enrich-product` role available
- Scheduler enqueues stale products (no enrichment in 24h) on each scheduler tick
