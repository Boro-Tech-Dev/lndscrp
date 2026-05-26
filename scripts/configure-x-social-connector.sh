#!/usr/bin/env bash
# One-time: store X auth cookies on the Ayvakit social connector (encrypted).
# Never commit tokens. Export before running:
#   export X_AUTH_TOKEN='...'
#   export X_CT0='...'
#   export LANDSCRAPE_INTERNAL_API_KEY='...'
#   export LANDSCRAPE_CREDENTIALS_KEY='...'   # required for encryption
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000}"
TENANT_SLUG="${TENANT_SLUG:-ayvakit}"

if [[ -z "${X_AUTH_TOKEN:-}" || -z "${X_CT0:-}" ]]; then
  echo "Set X_AUTH_TOKEN and X_CT0 from x.com DevTools → Application → Cookies" >&2
  exit 1
fi
if [[ -z "${LANDSCRAPE_INTERNAL_API_KEY:-}" ]]; then
  echo "Set LANDSCRAPE_INTERNAL_API_KEY" >&2
  exit 1
fi

CONNECTOR_ID="${CONNECTOR_ID:-}"
if [[ -z "$CONNECTOR_ID" ]]; then
  CONNECTOR_ID=$(curl -sS "${API_BASE}/v1/tenants/${TENANT_SLUG}/connectors" \
    -H "X-Landscrape-Internal-Key: ${LANDSCRAPE_INTERNAL_API_KEY}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('items',d); print(next((c['connector_id'] for c in items if c.get('connector_name')=='Ayvakit X Monitor'), ''))")
fi
if [[ -z "$CONNECTOR_ID" ]]; then
  echo "Could not find connector 'Ayvakit X Monitor'. Run db seed 014 or create connector via API." >&2
  exit 1
fi

curl -sS -X PATCH "${API_BASE}/v1/tenants/${TENANT_SLUG}/connectors/${CONNECTOR_ID}" \
  -H "Content-Type: application/json" \
  -H "X-Landscrape-Internal-Key: ${LANDSCRAPE_INTERNAL_API_KEY}" \
  -d "$(python3 -c "import json,os; print(json.dumps({'secrets': {'authToken': os.environ['X_AUTH_TOKEN'], 'ct0': os.environ['X_CT0']}}))")"

echo ""
echo "Configured social connector ${CONNECTOR_ID} for tenant ${TENANT_SLUG}."
