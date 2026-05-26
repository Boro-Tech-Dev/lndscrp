#!/usr/bin/env bash
# Pull GHCR images and restart the stack (no compile on VPS).
# Invoked by GitHub Actions or manually on the server after rsync.
set -euo pipefail

REMOTE_DIR="${LANDSCRAPE_VPS_DIR:-/opt/landscrape}"
export COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml:compose.vps.yml:compose.traefik.yml:compose.registry.yml}"

cd "$REMOTE_DIR"

if [[ ! -f .env ]]; then
  echo "error: $REMOTE_DIR/.env missing — copy from .env.vps.example and configure secrets" >&2
  exit 1
fi

echo "[remote-deploy] COMPOSE_FILE=$COMPOSE_FILE"
echo "[remote-deploy] pulling images from registry…"
docker compose pull

echo "[remote-deploy] starting/updating services…"
docker compose up -d

if [[ "${LANDSCRAPE_PRUNE_IMAGES:-false}" == "true" ]]; then
  echo "[remote-deploy] pruning unused images…"
  docker image prune -f
fi

echo "[remote-deploy] done"
docker compose ps
