#!/usr/bin/env bash
# Stop the stack started by scripts/wechat-up.sh.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO/.run"

for name in login bridge gateway; do
  pid_file="$RUN_DIR/$name.pid"
  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "stopped $name (pid $pid)"
    else
      echo "$name already stopped"
    fi
    rm -f "$pid_file"
  else
    echo "$name not running"
  fi
done
