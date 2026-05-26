# Implementation Notes

## What is wired today
- PostgreSQL schema with seeded tenant, sources, and one initial signal
- Express API with dashboard, signals, and report generation
- Worker that simulates source checks and writes signals
- Next.js client dashboard and admin console
- Keycloak realm `landscrape` with embedded web/admin login (BFF + JWT on API)
- Docker Compose production stack with Postgres, Redis, MinIO, Ollama, Keycloak

## What to swap next
- Replace synthetic worker adapters with real fetchers / RSS / scraper adapters
- Link Keycloak users to Postgres `users` table for audit `actor_user_id`
- Add real object-storage write paths for reports and uploaded documents
- Add test suites (unit, integration, e2e)
- Add migrations runner instead of bare SQL bootstrap
