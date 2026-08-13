#!/usr/bin/env bash
# Wire this plugin into a dsh profile's patch layer.
#
# By default this PRINTS the exact changes and commands without touching the
# running host. Pass --apply to actually write them (a dsh restart is then
# required for the new package dependency to load).
#
# Usage:
#   ./integration/install-into-dsh.sh [--profile web] [--mode bridge|mock] [--apply]

set -euo pipefail

PROFILE="web"
MODE="bridge"
APPLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BRIDGE_URL="${BRIDGE_URL:-http://127.0.0.1:3468}"
BRIDGE_API_KEY="${BRIDGE_API_KEY:-demo-key}"

PATCH_BLOCK="- insert:
    - id: deepseek-wechat-operator
      name: dsh-plugin-deepseek-wechat-operator
      config:
        mode: $MODE
        bridgeUrl: $BRIDGE_URL
        bridgeApiKey: $BRIDGE_API_KEY
        digestLimit: 10
        minimumScore: 0.45
"

echo "DSH_HOME  : $DSH_HOME"
echo "profile   : $PROFILE"
echo "patch file: $PATCH_FILE"
echo "plugin    : $PLUGIN_DIR"
echo "mode      : $MODE"
echo

echo "── commands to run ──────────────────────────────────────────────"
echo "mkdir -p \"$PROFILE_DIR\""
echo "cd \"$PROFILE_DIR\" && pnpm add \"file:$PLUGIN_DIR\""
echo
echo "── patch block to write to $PATCH_FILE ─────────────────────────"
printf '%s\n' "$PATCH_BLOCK"
echo "────────────────────────────────────────────────────────────────"
echo

if [[ "$APPLY" == "1" ]]; then
  mkdir -p "$PROFILE_DIR"
  if [[ -f "$PATCH_FILE" ]]; then
    echo "patch file exists; appending insert block (dedupe by id is on you)" >&2
    printf '%s\n' "$PATCH_BLOCK" >> "$PATCH_FILE"
  else
    printf '%s\n' "$PATCH_BLOCK" > "$PATCH_FILE"
  fi
  (cd "$PROFILE_DIR" && pnpm add "file:$PLUGIN_DIR")
  echo "done — restart dsh to load the new plugin dependency."
else
  echo "dry run — re-run with --apply to write and install."
fi
