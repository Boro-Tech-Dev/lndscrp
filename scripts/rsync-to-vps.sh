#!/usr/bin/env bash
# Sync LandScrape to the VPS without overwriting production secrets in .env.
# Usage: ./scripts/rsync-to-vps.sh [user@host]
set -euo pipefail

DEST="${1:-root@72.61.5.60:/opt/landscrape/}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude apps/web/.next \
  --exclude apps/admin/.next \
  "$ROOT/" "$DEST"

echo "Synced to $DEST (.env was not copied)"
