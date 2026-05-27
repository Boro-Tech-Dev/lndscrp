#!/usr/bin/env bash
# Pull GHCR images and restart the stack (no compile on VPS).
set -euo pipefail

REMOTE_DIR="${LANDSCRAPE_VPS_DIR:-/opt/landscrape}"
export COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml:compose.vps.yml:compose.traefik.yml:compose.registry.yml}"

cd "$REMOTE_DIR"

if [[ ! -f .env ]]; then
  echo "[remote-deploy] error: .env missing at $REMOTE_DIR/.env" >&2
  echo "[remote-deploy] CI: set GitHub secret VPS_DOTENV. Manual: cp .env.vps.example .env on the VPS." >&2
  exit 1
fi

# Compose reads .env for container env_file, but not always for ${VAR} in compose files.
set -a
# shellcheck source=/dev/null
source .env
set +a

bash "$REMOTE_DIR/infra/vps/validate-deploy-env.sh"

echo "[remote-deploy] COMPOSE_FILE=$COMPOSE_FILE"
echo "[remote-deploy] pulling images from registry…"
docker compose --profile social pull

echo "[remote-deploy] starting/updating services…"
docker compose --profile social up -d

if [[ "${LANDSCRAPE_PRUNE_IMAGES:-false}" == "true" ]]; then
  docker image prune -f
fi

echo "[remote-deploy] done"
docker compose ps
