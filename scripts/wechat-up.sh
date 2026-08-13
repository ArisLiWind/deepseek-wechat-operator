#!/usr/bin/env bash
# Bring up the full WeChat operator stack locally with ONE command:
#   Bun (local) → iLink gateway → bridge → login page
#
# After it prints the login URL, open it in your browser and scan the QR once
# with WeChat. Nothing is sent without your confirmation.
#
# Env overrides:
#   GATEWAY_DIR      where the iLink gateway lives (default: ../weixin-ilink-gateway)
#   GATEWAY_REPO     gateway git URL (default: Kadxy/weixin-ilink-gateway)
#   WECHAT_OPERATOR_API_KEY   gateway API key (default: random)
#   BRIDGE_PORT / GATEWAY_PORT / LOGIN_PORT   ports (3468 / 3456 / 3470)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO/.run"
GATEWAY_DIR="${GATEWAY_DIR:-$REPO/../weixin-ilink-gateway}"
GATEWAY_REPO="${GATEWAY_REPO:-https://github.com/Kadxy/weixin-ilink-gateway.git}"
BUN_DIR="$REPO/.bun"

API_KEY="${WECHAT_OPERATOR_API_KEY:-$(openssl rand -hex 12)}"
BRIDGE_PORT="${BRIDGE_PORT:-3468}"
GATEWAY_PORT="${GATEWAY_PORT:-3456}"
LOGIN_PORT="${LOGIN_PORT:-3470}"

mkdir -p "$RUN_DIR"

# --- Bun (installed into the repo, never ~/.bun) -----------------------------
if [[ ! -x "$BUN_DIR/bin/bun" ]]; then
  echo "› installing Bun locally ($BUN_DIR)…"
  BUN_INSTALL="$BUN_DIR" bash -c 'curl -fsSL https://bun.sh/install | bash' >/dev/null
fi
export PATH="$BUN_DIR/bin:$PATH"
export BUN_INSTALL_CACHE_DIR="$BUN_DIR/cache"

# --- Gateway (clone + deps) ---------------------------------------------------
if [[ ! -d "$GATEWAY_DIR" ]]; then
  echo "› cloning iLink gateway…"
  git clone --depth 1 "$GATEWAY_REPO" "$GATEWAY_DIR"
fi
if [[ ! -d "$GATEWAY_DIR/node_modules" ]]; then
  echo "› installing gateway deps (bun install)…"
  (cd "$GATEWAY_DIR" && bun install)
fi

# --- Start gateway ------------------------------------------------------------
(
  cd "$GATEWAY_DIR"
  API_KEY="$API_KEY" PORT="$GATEWAY_PORT" DATA_DIR="$GATEWAY_DIR/data" \
    WEBHOOK_URLS="http://127.0.0.1:$BRIDGE_PORT/ingest/ilink" \
    nohup "$BUN_DIR/bin/bun" run start >> "$RUN_DIR/gateway.log" 2>&1 &
  echo $! > "$RUN_DIR/gateway.pid"
)
echo "› gateway started on :$GATEWAY_PORT"

# --- Start bridge (auth disabled so the gateway's unauthenticated webhook lands) --
(
  cd "$REPO"
  nohup node ./src/bridge-server.js >> "$RUN_DIR/bridge.log" 2>&1 &
  echo $! > "$RUN_DIR/bridge.pid"
)
echo "› bridge started on :$BRIDGE_PORT"

# --- Start login page ---------------------------------------------------------
(
  cd "$REPO"
  GATEWAY_URL="http://127.0.0.1:$GATEWAY_PORT" GATEWAY_API_KEY="$API_KEY" LOGIN_PORT="$LOGIN_PORT" \
    nohup node ./src/login-server.js >> "$RUN_DIR/login.log" 2>&1 &
  echo $! > "$RUN_DIR/login.pid"
)
echo "› login page started on :$LOGIN_PORT"

sleep 2
echo
echo "✅ stack up"
echo "   login page → http://127.0.0.1:$LOGIN_PORT   (open this, scan the QR)"
echo "   gateway    → http://127.0.0.1:$GATEWAY_PORT"
echo "   bridge     → http://127.0.0.1:$BRIDGE_PORT"
echo "   api key    → $API_KEY"
echo "   stop       → bash scripts/wechat-down.sh"
