#!/usr/bin/env bash
# Swap .env across both workspaces between Windows-local and Mac-remote profiles.
#
# Usage:
#   scripts/switch-profile.sh windows   # both repos talk to local services on this Windows box
#   scripts/switch-profile.sh mac       # Mac runs turbo dev; Windows hosts FINA Brain over Tailscale
#
# Current .env in each workspace is backed up to .env.bak before being replaced.

set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "windows" && "$MODE" != "mac" ]]; then
  echo "Usage: $0 {windows|mac}" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AWAD2_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FINA_DIR="$(cd "$AWAD2_DIR/../Financial-AI-Model" && pwd)"

swap() {
  local dir="$1"
  local profile="$dir/.env.llm-local-agent-feature"
  local active="$dir/.env"

  if [[ ! -f "$profile" ]]; then
    echo "[skip] $profile not found" >&2
    return
  fi

  if [[ "$MODE" == "mac" ]]; then
    # Activate the Mac profile. Save the current (Windows-local) .env first.
    if [[ -f "$active" ]]; then
      cp "$active" "$dir/.env.windows.bak"
    fi
    cp "$profile" "$active"
    echo "[ok] $dir  →  mac profile active"
  else
    # Restore the Windows-local .env from backup if present.
    if [[ -f "$dir/.env.windows.bak" ]]; then
      cp "$dir/.env.windows.bak" "$active"
      echo "[ok] $dir  →  windows profile restored from .env.windows.bak"
    else
      echo "[warn] $dir has no .env.windows.bak — leaving .env untouched" >&2
    fi
  fi
}

swap "$AWAD2_DIR"
swap "$FINA_DIR"

echo
echo "Switched to '$MODE' profile."
echo "  AWAD2  : $AWAD2_DIR/.env"
echo "  FINA   : $FINA_DIR/.env"
