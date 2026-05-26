#!/usr/bin/env bash
# Apply password/secret rotation on a running VPS stack (run ON the server).
# Expects OLD values in /opt/landscrape/.env.old and NEW in /opt/landscrape/.env.
set -euo pipefail

REMOTE_DIR="${LANDSCRAPE_VPS_DIR:-/opt/landscrape}"
export COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml:compose.vps.yml:compose.traefik.yml:compose.registry.yml}"

cd "$REMOTE_DIR"

OLD_ENV="${1:-$REMOTE_DIR/.env.old}"
NEW_ENV="${2:-$REMOTE_DIR/.env}"

if [[ ! -f "$OLD_ENV" || ! -f "$NEW_ENV" ]]; then
  echo "usage: $0 [old-env-path] [new-env-path]" >&2
  echo "  need $OLD_ENV and $NEW_ENV" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$OLD_ENV"
OLD_POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
OLD_MINIO_ROOT_PASSWORD="$MINIO_ROOT_PASSWORD"
OLD_KEYCLOAK_ADMIN_PASSWORD="$KEYCLOAK_ADMIN_PASSWORD"
OLD_KEYCLOAK_CLIENT_SECRET="$KEYCLOAK_CLIENT_SECRET"
OLD_XACTIONS_POSTGRES_PASSWORD="${XACTIONS_POSTGRES_PASSWORD:-}"
set +a

# shellcheck disable=SC1090
set -a
source "$NEW_ENV"
NEW_POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
NEW_MINIO_ROOT_PASSWORD="$MINIO_ROOT_PASSWORD"
NEW_KEYCLOAK_ADMIN_PASSWORD="$KEYCLOAK_ADMIN_PASSWORD"
NEW_KEYCLOAK_CLIENT_SECRET="$KEYCLOAK_CLIENT_SECRET"
NEW_XACTIONS_POSTGRES_PASSWORD="${XACTIONS_POSTGRES_PASSWORD:-}"
set +a

echo "[rotate] PostgreSQL (landscrape)…"
docker compose exec -T postgres psql -U "${POSTGRES_USER:-landscrape}" -d "${POSTGRES_DB:-landscrape}" \
  -v ON_ERROR_STOP=1 \
  -c "ALTER USER ${POSTGRES_USER:-landscrape} WITH PASSWORD '${NEW_POSTGRES_PASSWORD}';"

if docker compose ps --status running xactions-postgres 2>/dev/null | grep -q xactions-postgres; then
  echo "[rotate] PostgreSQL (xactions)…"
  docker compose exec -T xactions-postgres psql -U xactions -d xactions -v ON_ERROR_STOP=1 \
    -c "ALTER USER xactions WITH PASSWORD '${NEW_XACTIONS_POSTGRES_PASSWORD}';"
fi

echo "[rotate] MinIO root password…"
if docker compose ps --status running minio 2>/dev/null | grep -q minio; then
  if ! docker compose exec -T minio sh -ec "
    set -e
    mc alias set local http://127.0.0.1:9000 '${MINIO_ROOT_USER:-landscrape}' '${OLD_MINIO_ROOT_PASSWORD}'
    mc admin user add local '${MINIO_ROOT_USER:-landscrape}' '${NEW_MINIO_ROOT_PASSWORD}'
  "; then
    echo "[rotate] warn: MinIO password not updated via mc (may need MinIO Console once). .env still uses the new password." >&2
  fi
fi

echo "[rotate] Keycloak client + admin…"
docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://127.0.0.1:8080 \
  --realm master \
  --user "${KEYCLOAK_ADMIN:-admin}" \
  --password "$OLD_KEYCLOAK_ADMIN_PASSWORD" >/dev/null

CLIENT_ID="$(docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh get clients -r landscrape \
  -q "clientId=landscrape-web" --fields id | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1 | tr -d '\r')"
if [[ -z "$CLIENT_ID" ]]; then
  echo "[rotate] error: could not resolve Keycloak client id for landscrape-web" >&2
  exit 1
fi
docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh update "clients/${CLIENT_ID}" -r landscrape \
  -s "secret=${NEW_KEYCLOAK_CLIENT_SECRET}"

docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh set-password \
  -r master \
  --username "${KEYCLOAK_ADMIN:-admin}" \
  --new-password "$NEW_KEYCLOAK_ADMIN_PASSWORD"

echo "[rotate] flushing Redis sessions (Keycloak rotation invalidates all tokens)…"
if docker compose ps --status running redis 2>/dev/null | grep -q redis; then
  docker compose exec -T redis redis-cli EVAL \
    "local keys = redis.call('keys', 'landscrape:session:*'); if #keys == 0 then return 0 else return redis.call('del', unpack(keys)) end" 0 \
    || docker compose exec -T redis redis-cli --scan --pattern 'landscrape:session:*' \
      | xargs -r docker compose exec -T redis redis-cli DEL
fi

echo "[rotate] done (databases + Keycloak). Install new .env then: docker compose up -d"
