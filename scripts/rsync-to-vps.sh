#!/usr/bin/env bash
# Sync LandScrape to the VPS without overwriting production secrets in .env.
# Usage: ./scripts/rsync-to-vps.sh [user@host]
# Default destination: root@72.61.5.60:/opt/landscrape/
set -euo pipefail

DEST="${1:-root@72.61.5.60:/opt/landscrape/}"

if [[ "$DEST" == *"other-host"* ]]; then
  echo "error: '$DEST' looks like a documentation placeholder." >&2
  echo "Use the default (no arguments): ./scripts/rsync-to-vps.sh" >&2
  echo "Or set a real host: ./scripts/rsync-to-vps.sh root@72.61.5.60:/opt/landscrape/" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Syncing to $DEST"

rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude apps/web/.next \
  --exclude apps/admin/.next \
  "$ROOT/" "$DEST"

echo "Synced to $DEST (.env was not copied)"
