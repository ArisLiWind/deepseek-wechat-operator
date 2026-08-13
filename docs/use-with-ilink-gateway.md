# Using with a real iLink gateway

This repo ships **no WeChat transport**. To actually send and receive real
微信 messages you run a separate gateway that speaks Tencent's **iLink Bot
protocol** (the "ClawBot" channel), and point it at this bridge.

## What the research established (Aug 2026)

- The iLink protocol is Tencent's official, QR-login **bot** channel
  (`https://ilinkai.weixin.qq.com`, long-poll inbound, replies must echo the
  inbound message's `context_token`). It is the first officially-backed path to
  a personal-WeChat bot — no ban risk on normal use, but bound by WeChat's
  consumer ToS (rate caps, content filtering, and termination are at Tencent's
  discretion). See [wechatbot.dev protocol](https://www.wechatbot.dev/zh/protocol)
  and Tencent's [`@tencent-weixin/openclaw-weixin`](https://github.com/Tencent/openclaw-weixin).
- A self-hosted gateway that wraps this protocol into clean HTTP is
  [Kadxy/weixin-ilink-gateway](https://github.com/Kadxy/weixin-ilink-gateway)
  (MIT). It can **send** (text/image/video/file) and **receive** (background
  long-poll), and can **push inbound messages to your webhook URLs**.
- **Runtime:** it is a **Bun** project, not Node. Bun v1.0+ is required (Node
  v24 alone cannot run it). Bun has native macOS builds.

## Topology

```text
WeChat (Tencent iLink / ClawBot)
   ↕ QR-login bot_token · long-poll · context_token
weixin-ilink-gateway (Bun)          ← the REAL transport
   ↕ HTTP (localhost)
DeepSeek WeChat Operator bridge (Node)
   ↕ HTTP /items · /actions/send-text
dsh plugin (wechat_* tools)
```

## 1. Run the gateway

```sh
git clone https://github.com/Kadxy/weixin-ilink-gateway.git
cd weixin-ilink-gateway
curl -fsSL https://bun.sh/install | bash    # Bun, not Node
cp .env.example .env
#   API_KEY=$(openssl rand -hex 16)
#   WEBHOOK_URLS=http://127.0.0.1:3468/ingest/ilink   ← push inbound to our bridge
bun install
bun run start                               # serves http://127.0.0.1:3456
```

Then `POST /auth/login` (or open `GET /console`), scan the QR with WeChat, and
wait for `logged_in`. From then on the gateway long-polls WeChat and pushes each
inbound WeixinMessage to `WEBHOOK_URLS`.

> The gateway's outbound push has no auth header of its own, so run the bridge
> with auth disabled (`WECHAT_OPERATOR_API_KEY` unset) when both live on one
> machine behind `127.0.0.1`. This is why the default bridge binds 127.0.0.1.

## 2. Run this bridge pointed at the gateway

```sh
cd deepseek-wechat-operator
WECHAT_OPERATOR_OUTBOUND=ilink-gateway \
ILINK_GATEWAY_SEND_URL=http://127.0.0.1:3456/messages/send \
ILINK_GATEWAY_API_KEY=<the gateway's API_KEY> \
npm run bridge:dev
```

With `WECHAT_OPERATOR_OUTBOUND` unset (or anything but `ilink-gateway`), the
bridge stays in `record-only` mode and never transmits — the safe default.

## 3. End-to-end flow

1. Someone messages your bot in WeChat.
2. Gateway long-polls it, POSTs the raw WeixinMessage to
   `POST /ingest/ilink` on the bridge.
3. The bridge normalizes it (handles `item_list` text/image/voice/file/video)
   and caches the `context_token`.
4. `wechat_digest_world` / `wechat_find` / `wechat_rank_replies` read those
   items; `wechat_prepare_reply` drafts; `wechat_send_message` (with
   `confirm: true`) calls `POST /actions/send-text`.
5. The bridge resolves the cached `context_token` and dispatches
   `POST /messages/send` to the gateway, which sends the real reply.

## Payload contracts

Inbound (gateway → bridge), a raw WeixinMessage:

```json
{
  "message_id": "real-msg-001",
  "from_user_id": "alice@im.wechat",
  "from_user_name": "Alice",
  "create_time_ms": 1789290000000,
  "context_token": "CTX-REAL-001",
  "item_list": [
    { "type": 1, "text_item": { "text": "预算范围是多少？" } }
  ]
}
```

Outbound (bridge → gateway), `POST /messages/send`:

```json
{ "to": "alice@im.wechat", "context_token": "CTX-REAL-001",
  "items": [{ "type": "text", "text": "预算 50 万，周期 6 个月。" }] }
```

## Caveats

- **No cold outreach**: a `context_token` exists only after a user has messaged
  the bot first; `wechat_send_message` cannot send to a user who has not
  written in.
- **1:1 owner↔bot**: the gateway does not implement group messaging.
- **Protocol drift**: the gateway pins `@tencent-weixin/openclaw-weixin`
  2.1.8 while npm latest is 2.4.6; expect the unofficial SDKs to need updates.
