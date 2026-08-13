# DeepSeek WeChat Operator

English · [中文](./README.zh.md) · [CI](https://github.com/ArisLiWind/deepseek-wechat-operator/actions/workflows/ci.yml) · [MIT](./LICENSE)

Give the agent inside [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) a WeChat butler: read, filter, rank, and draft replies — and **stop to confirm before sending**.

Once installed, the one line that drives everything:

> **总管，帮我看一下微信。** ("Butler, check my WeChat for me.")

The plugin ships a built-in "微信总管" persona: that phrase triggers `digest → rank → draft → confirm-before-send`. Sending is Yellow-gated and **never fires automatically**.

## 🚀 Fastest: 3 steps to a real WeChat

```sh
# 1) clone + install
git clone https://github.com/ArisLiWind/deepseek-wechat-operator.git && cd deepseek-wechat-operator && npm install

# 2) one-command bring-up (installs Bun locally, clones the gateway, starts the bridge),
#    then open http://127.0.0.1:3470 and scan the QR once
bash scripts/wechat-up.sh

# 3) mount into dsh; after restarting, say "总管帮我看一下微信" in a new session
./integration/install-into-dsh.sh --apply
npm run doctor   # should be all green
```

> The QR authorizes a **bot identity** of your WeChat: 1:1, no groups, only messages that arrive after login, and every send is confirmed first — that is Tencent's iLink channel, by design.
> The "Quick start" below is the mock (no real WeChat) smoke test; full real-WeChat details: [docs/use-with-ilink-gateway.md](./docs/use-with-ilink-gateway.md).

---

## Quick start

### 1 · Prove it runs (no dsh, no WeChat needed)

```sh
git clone https://github.com/ArisLiWind/deepseek-wechat-operator.git
cd deepseek-wechat-operator
npm install
npm test          # 22 tests pass = the plugin loads and every tool executes
npm run demo:json # digest / rank / opportunity extraction over built-in fixtures
```

### 2 · Mount it into dsh (`mock` mode first)

```sh
# Recommended: one-shot helper (dry-run by default; add --apply to install):
./integration/install-into-dsh.sh --mode mock --apply

# dsh CLI (run from this repo's root):
dsh plugin --profile web add "file:$PWD"

# manual (DSH_HOME defaults to ~/.dsh; capture the repo path BEFORE cd):
REPO="$PWD"; mkdir -p "$DSH_HOME/profiles/web" && cd "$DSH_HOME/profiles/web" && pnpm add "file:$REPO"
```

Then write `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: deepseek-wechat-operator
      name: dsh-plugin-deepseek-wechat-operator
      config:
        mode: mock
        digestLimit: 10
        minimumScore: 0.45
```

Restart dsh, then verify the wiring with `npm run doctor`.

### 3 · Say the line in a new session

> **总管，帮我看一下微信。**

It runs the full chain over the `mock` fixtures (proving the plugin works — not your real WeChat). Full install details: [`docs/install-into-dsh.md`](./docs/install-into-dsh.md).

---

## What it can do

Six tools (registered in [`src/index.js`](./src/index.js)):

| Tool | Purpose | Gate |
|---|---|---|
| `wechat_digest_world` | Compress today's items into the few that matter | Green |
| `wechat_find` | Find messages/files/people/opportunities by keyword | Green |
| `wechat_rank_replies` | Rank who is most worth replying to | Green |
| `wechat_prepare_reply` | Draft a reply + return its approval level | Green |
| `wechat_plan_automation` | Turn a filter intent into a rule draft | Green |
| `wechat_send_message` | Actually send a reply | **Yellow** (`confirm:true` required) |

**Honest scope (read this):**

- `mock` mode reads built-in **fake data**, for demos and iteration.
- `bridge` mode reads real inbound events, but outbound is **`record-only` by default** — replies are persisted, never sent.
- Actually **sending** to WeChat requires a separate iLink/ClawBot gateway (install Bun + scan a QR), see [`docs/use-with-ilink-gateway.md`](./docs/use-with-ilink-gateway.md). This repo does not fake that step.

## Repository layout

- [`src/index.js`](./src/index.js): dsh plugin entry (six tools + the 微信总管 persona)
- [`src/outbound.js`](./src/outbound.js): outbound adapter (`record-only` default / `ilink-gateway` real send)
- [`src/normalize.js`](./src/normalize.js): normalize iLink `WeixinMessage` into readable items
- [`src/bridge-server.js`](./src/bridge-server.js): local HTTP bridge
- [`src/bridge-service.js`](./src/bridge-service.js): bridge client
- [`src/domain.js`](./src/domain.js): pure digest/find/rank/draft logic
- [`src/policy.js`](./src/policy.js): Green/Yellow/Red action policy
- [`integration/agent.cordis.patch.yml`](./integration/agent.cordis.patch.yml): ready-to-apply dsh patch
- [`integration/install-into-dsh.sh`](./integration/install-into-dsh.sh): one-shot install helper (dry-run by default)
- [`docs/install-into-dsh.md`](./docs/install-into-dsh.md): dsh install steps
- [`docs/use-with-ilink-gateway.md`](./docs/use-with-ilink-gateway.md): wiring a real iLink/ClawBot gateway

## Real WeChat (bridge mode)

```sh
cd deepseek-wechat-operator
WECHAT_OPERATOR_API_KEY=demo-key npm run bridge:dev   # http://127.0.0.1:3468
```

Push a real-format inbound event:

```sh
curl -X POST http://127.0.0.1:3468/ingest/ilink \
  -H 'Authorization: Bearer demo-key' -H 'Content-Type: application/json' \
  --data @examples/bridge-event.ilink.json
```

Switch the patch to `mode: bridge` ([`examples/cordis.bridge.patch.yml`](./examples/cordis.bridge.patch.yml)) and ask "what are the 10 most important things today".

To actually send, also configure outbound:

```sh
WECHAT_OPERATOR_OUTBOUND=ilink-gateway \
ILINK_GATEWAY_SEND_URL=http://127.0.0.1:3456/messages/send \
ILINK_GATEWAY_API_KEY=<gateway key> \
npm run bridge:dev
```

Full chain: [`docs/use-with-ilink-gateway.md`](./docs/use-with-ilink-gateway.md).

## Permission model

- `Green`: read, summarize, classify, search, dedupe, save — auto-run
- `Yellow`: outbound messages, forwards, task edits, calendar writes, bulk actions — **confirm first**
- `Red`: payments, destructive deletes, public posting, sensitive sends, account security — hard-confirm

## Local validation

```sh
npm run check
```

Runs `node --test`, `demo`, `e2e-demo`, `perf-demo`, and `npm pack --dry-run`. CI runs the same on push/PR.

## Docs

- Gateway integration: [`docs/use-with-ilink-gateway.md`](./docs/use-with-ilink-gateway.md)
- dsh install: [`docs/install-into-dsh.md`](./docs/install-into-dsh.md)
- Product brief: [`docs/product.md`](./docs/product.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- Performance notes: [`docs/performance.md`](./docs/performance.md)
- Roadmap: [`docs/roadmap.md`](./docs/roadmap.md)
