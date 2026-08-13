#!/usr/bin/env bash
# Wire this plugin into a dsh profile's patch layer.
#
# Default is a DRY-RUN: it prints exactly what it would write/run without
# touching the host. Pass --apply to actually write the patch and install the
# package. Re-running with --apply is idempotent (it will not append a duplicate
# insert block).
#
# Usage:
#   ./integration/install-into-dsh.sh [--profile web] [--mode bridge|mock] [--apply] [--doctor]

set -euo pipefail

PROFILE="web"
MODE="bridge"
APPLY=0
RUN_DOCTOR=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    --doctor) RUN_DOCTOR=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BRIDGE_URL="${BRIDGE_URL:-http://127.0.0.1:3468}"
BRIDGE_API_KEY="${BRIDGE_API_KEY:-demo-key}"

# --- prerequisite checks -----------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found on PATH" >&2
  exit 3
fi

NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [[ -z "$NODE_MAJOR" ]] || [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "error: Node.js >= 22 required (found: ${NODE_MAJOR:-none})" >&2
  exit 3
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm not found on PATH (needed to install the plugin into the profile)" >&2
  exit 3
fi

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

echo "── patch block (to $PATCH_FILE) ────────────────────────────────"
printf '%s\n' "$PATCH_BLOCK"
echo "────────────────────────────────────────────────────────────────"
echo

if [[ "$APPLY" == "1" ]]; then
  mkdir -p "$PROFILE_DIR"

  if grep -q "id: deepseek-wechat-operator" "$PATCH_FILE" 2>/dev/null; then
    echo "patch already lists deepseek-wechat-operator — leaving $PATCH_FILE unchanged."
  else
    if [[ -f "$PATCH_FILE" ]]; then
      printf '\n%s\n' "$PATCH_BLOCK" >> "$PATCH_FILE"
    else
      printf '%s\n' "$PATCH_BLOCK" > "$PATCH_FILE"
    fi
    echo "wrote patch block to $PATCH_FILE"
  fi

  (cd "$PROFILE_DIR" && pnpm add "file:$PLUGIN_DIR")
  echo "installed plugin into profile $PROFILE"
  echo
  echo "done — restart dsh to load the new plugin dependency, then run: npm run doctor"
else
  echo "dry run — re-run with --apply to write and install."
fi

if [[ "$RUN_DOCTOR" == "1" ]]; then
  echo
  echo "── doctor ──────────────────────────────────────────────────────"
  node "$PLUGIN_DIR/src/doctor.js" || true
fi
