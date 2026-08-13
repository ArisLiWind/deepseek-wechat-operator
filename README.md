# DeepSeek WeChat Operator

English | [中文](./README.zh.md)

`DeepSeek WeChat Operator` gives you a natural-language way to operate your WeChat information flow on top of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Feed it **accessible, user-authorized WeChat information** and you can immediately do things like:

- `Ask`: ask questions about your WeChat world
- `Find`: locate messages, files, links, and opportunities
- `Digest`: compress a noisy day into the 10 things that matter
- `Act`: draft or queue actions with approval gates
- `Automate`: define long-term filters and routines

With DeepSeek Harness underneath, this project turns WeChat-facing inputs into an Agent workflow layer for reading, filtering, searching, summarizing, planning, and preparing actions.

## Positioning

> DeepSeek for WeChat — Read everything that matters. Do what needs to be done.

Chinese:

> 让 DeepSeek 接管你的微信信息工作。

The first version works on a concrete, practical surface:

- content the user forwards to the agent
- official bot-channel events that are actually delivered
- public links the user authorizes the agent to fetch
- files, images, PDFs, spreadsheets, and voice notes the user explicitly provides

## What ships in this repository

- A publishable `dsh` plugin entry at [`src/index.js`](./src/index.js)
- Ranking, digest, reply, and opportunity extraction logic in [`src/domain.js`](./src/domain.js)
- A clear action-policy gate in [`src/policy.js`](./src/policy.js)
- A real event bridge with local persistence in [`src/bridge-server.js`](./src/bridge-server.js) and [`src/bridge-service.js`](./src/bridge-service.js)
- Payload normalization for iLink-compatible inbound events in [`src/normalize.js`](./src/normalize.js)
- A built-in mock data mode for product demos in [`src/fixtures.js`](./src/fixtures.js)
- A polished command-center demo in [`web/index.html`](./web/index.html)
- A sample `dsh` overlay in [`examples/cordis.patch.yml`](./examples/cordis.patch.yml)
- A bridge-mode `dsh` overlay in [`examples/cordis.bridge.patch.yml`](./examples/cordis.bridge.patch.yml)
- Launch assets in [`assets/`](./assets)

## First-version hero feature

The hero feature is not "control WeChat."

It is:

**Compress my WeChat world into the 10 things actually worth my attention today.**

That can include:

- articles worth reading
- people worth replying to
- opportunities worth tracking
- files worth saving
- facts worth remembering
- actions worth taking

## Architecture

```text
DeepSeek WeChat Operator
  User Intent
      |
      v
  Agent Orchestrator
      |
      +--> Memory
      +--> Planner
      +--> Policy Gate
      |
      v
  Tool Registry
      |
      +--> WeChat Tools
      +--> Content Tools
      +--> External Tools
      |
      v
  Action Ledger
```

The most important parts are not the model alone, but the **Tool Registry**, **Policy Gate**, and **Memory** layer.

## Permission model

- `Green`: auto-run read, summarize, classify, dedupe, save, and knowledge-base updates
- `Yellow`: require approval before outbound messages, forwards, task edits, calendar writes, or bulk actions
- `Red`: always hard-confirm payments, destructive deletes, public posting, sensitive file sends, or account-security actions

## Plugin tools

This repo registers a first practical surface:

- `wechat_digest_world`
- `wechat_find`
- `wechat_rank_replies`
- `wechat_prepare_reply`
- `wechat_plan_automation`

The current implementation is intentionally honest:

- a built-in `mock` mode works today for demos and product iteration
- a `bridge` mode now accepts real inbound events through a local HTTP bridge
- reply validation respects the iLink constraint that outbound replies require a cached inbound `context_token`

## Install

After publishing this package:

```sh
pnpm add dsh-plugin-deepseek-wechat-operator
```

Then add the overlay from [`examples/cordis.patch.yml`](./examples/cordis.patch.yml) to your `dsh` profile.

For bridge-backed usage:

```sh
WECHAT_OPERATOR_API_KEY=demo-key npm run bridge:dev
```

Then ingest an iLink-style event:

```sh
curl -X POST http://127.0.0.1:3468/ingest/ilink \
  -H 'Authorization: Bearer demo-key' \
  -H 'Content-Type: application/json' \
  --data @examples/bridge-event.ilink.json
```

And point `dsh` at the bridge via [`examples/cordis.bridge.patch.yml`](./examples/cordis.bridge.patch.yml).

## Local validation

```sh
node --test
node ./src/demo.js
npm run demo:e2e
npm pack --dry-run
```

## Repo publishing checklist

- Add the `dsh-plugin` topic
- Publish the npm package publicly
- Include launch assets from [`assets/`](./assets)
- Document the supported data boundary clearly
- Do not market unsupported personal-WeChat powers

## Docs

- Product brief: [`docs/product.md`](./docs/product.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- Gateway integration: [`docs/use-with-ilink-gateway.md`](./docs/use-with-ilink-gateway.md)
- Performance notes: [`docs/performance.md`](./docs/performance.md)
- Roadmap: [`docs/roadmap.md`](./docs/roadmap.md)
- X post draft: [`docs/x-post.md`](./docs/x-post.md)
