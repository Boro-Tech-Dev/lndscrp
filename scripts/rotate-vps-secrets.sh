#!/usr/bin/env bash
# Push new .env to VPS, rotate live DB/Keycloak/MinIO passwords, restart stack.
# Usage: ./scripts/rotate-vps-secrets.sh [path-to-new-env]
# Requires: landscrape-vps-deploy key, running stack at /opt/landscrape
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NEW_ENV="${1:-$HOME/.landscrape-vps.env}"
HOST="${LANDSCRAPE_VPS_HOST:-root@72.61.5.60}"
REMOTE_DIR="${LANDSCRAPE_VPS_DIR:-/opt/landscrape}"
SSH_KEY="${LANDSCRAPE_VPS_SSH_KEY:-$ROOT/landscrape-vps-deploy}"
SSH_OPTS=(-o StrictHostKeyChecking=yes)
[[ -f "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")

if [[ ! -f "$NEW_ENV" ]]; then
  echo "error: new env file not found: $NEW_ENV" >&2
  echo "Run: ./scripts/generate-vps-env.sh" >&2
  exit 1
fi

echo "Backing up server .env → .env.old"
ssh "${SSH_OPTS[@]}" "$HOST" "cp -a '${REMOTE_DIR}/.env' '${REMOTE_DIR}/.env.old'"

echo "Uploading new .env"
scp -q "${SSH_OPTS[@]}" "$NEW_ENV" "$HOST:${REMOTE_DIR}/.env.new"
ssh "${SSH_OPTS[@]}" "$HOST" "chmod 600 '${REMOTE_DIR}/.env.new'"

echo "Applying rotation on server (Postgres, Keycloak, MinIO)…"
ssh "${SSH_OPTS[@]}" "$HOST" "bash '${REMOTE_DIR}/infra/vps/apply-rotated-secrets.sh' '${REMOTE_DIR}/.env.old' '${REMOTE_DIR}/.env.new'"

echo "Validating new .env (GHCR image vars)"
ssh "${SSH_OPTS[@]}" "$HOST" "set -a && source '${REMOTE_DIR}/.env.new' && set +a && bash '${REMOTE_DIR}/infra/vps/validate-deploy-env.sh'"

echo "Activating .env and restarting stack"
ssh "${SSH_OPTS[@]}" "$HOST" "mv '${REMOTE_DIR}/.env.new' '${REMOTE_DIR}/.env' && bash '${REMOTE_DIR}/infra/vps/remote-deploy.sh'"

echo ""
echo "Rotation complete. Update GitHub secret VPS_DOTENV with the same file:"
echo "  $NEW_ENV"
echo ""
echo "All users must sign in again. Encrypted connector secrets (X/Twitter) must be re-configured"
echo "because LANDSCRAPE_CREDENTIALS_KEY changed."
