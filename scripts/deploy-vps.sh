#!/usr/bin/env bash
# VPS deploy helpers (pull from GHCR — no compile on server by default).
# Usage: ./scripts/deploy-vps.sh <sync|pull|up|deploy|up-app|up-web|up-workers|up-social|fresh>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${LANDSCRAPE_VPS_HOST:-root@72.61.5.60}"
REMOTE_DIR="${LANDSCRAPE_VPS_DIR:-/opt/landscrape}"
SSH_KEY="${LANDSCRAPE_VPS_SSH_KEY:-$ROOT/landscrape-vps-deploy}"
SSH_OPTS=()
[[ -f "$SSH_KEY" ]] && SSH_OPTS=(-i "$SSH_KEY")

export COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml:compose.vps.yml:compose.traefik.yml:compose.registry.yml}"

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "$HOST" "$@"
}

ssh_compose() {
  ssh_cmd "cd $REMOTE_DIR && export COMPOSE_FILE='$COMPOSE_FILE' && docker compose $*"
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
  deploy)
    "$ROOT/scripts/rsync-to-vps.sh"
    if [[ -n "${LANDSCRAPE_VPS_ENV_FILE:-}" ]]; then
      if [[ ! -f "$LANDSCRAPE_VPS_ENV_FILE" ]]; then
        echo "error: LANDSCRAPE_VPS_ENV_FILE=$LANDSCRAPE_VPS_ENV_FILE not found" >&2
        exit 1
      fi
      scp -q "${SSH_OPTS[@]}" "$LANDSCRAPE_VPS_ENV_FILE" "$HOST:${REMOTE_DIR}/.env"
      ssh "$HOST" "chmod 600 ${REMOTE_DIR}/.env"
      echo "Uploaded .env from $LANDSCRAPE_VPS_ENV_FILE"
    fi
    ssh_cmd "bash ${REMOTE_DIR}/infra/vps/remote-deploy.sh"
    ;;
  up-app)
    ssh_compose pull web api agent mcp-fda mcp-pubmed mcp-clinicaltrials
    ssh_compose up -d web api agent mcp-fda mcp-pubmed mcp-clinicaltrials
    ;;
  up-web)
    ssh_compose pull web
    ssh_compose up -d web
    ;;
  up-workers)
    ssh_compose pull worker-scheduler worker-ingest worker-embed worker-enrich worker-reconcile worker-inbound worker-export worker-portal
    ssh_compose up -d worker-scheduler worker-ingest worker-embed worker-enrich worker-reconcile worker-inbound worker-export worker-portal
    ;;
  up-social)
    ssh_compose pull xactions-api xactions-worker worker-social
    ssh_compose --profile social up -d
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
     docker compose up -d mcp-fda mcp-pubmed mcp-clinicaltrials agent api web
     docker compose up -d worker-scheduler worker-ingest worker-embed worker-enrich worker-reconcile worker-inbound worker-export worker-portal
     docker compose --profile social up -d

See docs/deploy-vps.md for details.
EOF
    ;;
  *)
    echo "Usage: $0 <sync|pull|up|deploy|up-app|up-web|up-workers|up-social|fresh>" >&2
    echo "  COMPOSE_FILE=$COMPOSE_FILE" >&2
    echo "  HOST=$HOST  REMOTE_DIR=$REMOTE_DIR" >&2
    exit 1
    ;;
esac
