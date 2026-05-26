#!/usr/bin/env bash
# Provision file-backed swap for LandScrape VPS deploy (default 16 GB).
# Idempotent — safe to re-run.
set -euo pipefail

SWAP_SIZE_GB="${SWAP_SIZE_GB:-16}"
SWAPFILE="${SWAPFILE:-/swapfile}"
SYSCTL_CONF="/etc/sysctl.d/99-landscrape-swap.conf"
SWAPPINESS=10

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

# Already active at target size?
if swapon --show 2>/dev/null | grep -q "^${SWAPFILE} "; then
  current_mb=$(swapon --show --bytes --noheadings | awk '/^\/swapfile/{print int($3/1024/1024)}')
  target_mb=$((SWAP_SIZE_GB * 1024))
  if [[ "${current_mb:-0}" -ge "${target_mb}" ]]; then
    echo "[swap] ${SWAPFILE} already active (~${current_mb} MiB)"
    free -h
    exit 0
  fi
  echo "[swap] ${SWAPFILE} exists but is smaller than ${SWAP_SIZE_GB}G — remove manually to resize" >&2
  exit 1
fi

if [[ -f "${SWAPFILE}" ]]; then
  echo "[swap] ${SWAPFILE} exists but is not active — activating"
  chmod 600 "${SWAPFILE}"
  mkswap "${SWAPFILE}" >/dev/null
  swapon "${SWAPFILE}"
else
  echo "[swap] creating ${SWAP_SIZE_GB}G swap at ${SWAPFILE}"
  if command -v fallocate >/dev/null 2>&1; then
    fallocate -l "${SWAP_SIZE_GB}G" "${SWAPFILE}"
  else
    dd if=/dev/zero of="${SWAPFILE}" bs=1M count=$((SWAP_SIZE_GB * 1024)) status=progress
  fi
  chmod 600 "${SWAPFILE}"
  mkswap "${SWAPFILE}"
  swapon "${SWAPFILE}"
fi

if ! grep -q "^${SWAPFILE} " /etc/fstab 2>/dev/null; then
  echo "${SWAPFILE} none swap sw 0 0" >> /etc/fstab
  echo "[swap] added ${SWAPFILE} to /etc/fstab"
fi

echo "vm.swappiness=${SWAPPINESS}" > "${SYSCTL_CONF}"
sysctl --system >/dev/null 2>&1 || sysctl -p "${SYSCTL_CONF}" >/dev/null 2>&1 || true

echo "[swap] done"
free -h
swapon --show
