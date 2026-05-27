#!/usr/bin/env bash
# Re-queue failed sources for ingest after Ollama/swap fixes.
set -euo pipefail

REMOTE_DIR="${LANDSCRAPE_VPS_DIR:-/opt/landscrape}"
export COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml:compose.vps.yml:compose.traefik.yml:compose.registry.yml}"

cd "$REMOTE_DIR"

echo "[recover-ingest] resetting failed sources (last_checked_at / last_status)…"
docker compose exec -T postgres psql -U landscrape -d landscrape -v ON_ERROR_STOP=1 -c "
UPDATE sources
SET last_checked_at = NULL, last_status = NULL
WHERE is_active = TRUE AND last_status = 'failed';
"

count=$(docker compose exec -T postgres psql -U landscrape -d landscrape -t -A -c \
  "SELECT COUNT(*) FROM sources WHERE is_active = TRUE AND last_checked_at IS NULL;")
echo "[recover-ingest] sources ready for scheduler: ${count}"
echo "[recover-ingest] watch: docker compose logs -f worker-scheduler worker-ingest"
