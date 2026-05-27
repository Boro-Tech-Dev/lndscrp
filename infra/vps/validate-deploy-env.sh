#!/usr/bin/env bash
# Preflight: required vars for GHCR compose pull (sourced .env).
set -euo pipefail

missing=()
for var in LANDSCRAPE_IMAGE_REGISTRY LANDSCRAPE_IMAGE_OWNER LANDSCRAPE_IMAGE_TAG DATABASE_URL; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "[validate-deploy-env] error: missing required variables:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "[validate-deploy-env] ok (registry=${LANDSCRAPE_IMAGE_REGISTRY}/${LANDSCRAPE_IMAGE_OWNER} tag=${LANDSCRAPE_IMAGE_TAG})"
