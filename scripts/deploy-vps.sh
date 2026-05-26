#!/usr/bin/env bash
# VPS deploy helpers (pull from GHCR — no compile on server by default).
# Usage: ./scripts/deploy-vps.sh <sync|pull|up|up-app|up-web|fresh>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${LANDSCRAPE_VPS_HOST:-root@72.61.5.60}"
REMOTE_DIR="${LANDSCRAPE_VPS_DIR:-/opt/landscrape}"

export COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml:compose.vps.yml:compose.traefik.yml:compose.registry.yml}"

ssh_compose() {
  ssh "$HOST" "cd $REMOTE_DIR && export COMPOSE_FILE='$COMPOSE_FILE' && docker compose $*"
}

cmd="${1:-}"
case "$cmd" in
  sync)
    "$ROOT/scripts/rsync-to-vps.sh"
    ;;
  pull)
    ssh_compose pull
    ;;
  up)
    ssh_compose up -d
    ;;
  up-app)
    ssh_compose pull web admin api agent mcp-fda mcp-pubmed mcp-clinicaltrials
    ssh_compose up -d web admin api agent mcp-fda mcp-pubmed mcp-clinicaltrials
    ;;
  up-web)
    ssh_compose pull web admin
    ssh_compose up -d web admin
    ;;
  fresh)
    cat <<EOF
Fresh VPS sequence (run on server after sync + .env configured):

  1. bash $REMOTE_DIR/infra/vps/setup-swap.sh
  2. echo "\$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
  3. cd $REMOTE_DIR
     export COMPOSE_FILE=$COMPOSE_FILE
     docker compose pull
     docker compose up -d postgres redis minio ollama
     docker compose up -d ollama-init keycloak
     docker compose up -d mcp-fda mcp-pubmed mcp-clinicaltrials agent api web admin
     docker compose up -d worker-scheduler worker-ingest worker-embed worker-enrich worker-reconcile worker-inbound worker-export worker-portal

See docs/deploy-vps.md for details.
EOF
    ;;
  *)
    echo "Usage: $0 <sync|pull|up|up-app|up-web|fresh>" >&2
    echo "  COMPOSE_FILE=$COMPOSE_FILE" >&2
    echo "  HOST=$HOST  REMOTE_DIR=$REMOTE_DIR" >&2
    exit 1
    ;;
esac
