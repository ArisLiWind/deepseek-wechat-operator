# DeepSeek WeChat Operator

`DeepSeek WeChat Operator` is a public, publishable `dsh-plugin` repository built on top of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

It is not "AI fully controls my private WeChat." It is a policy-gated Agent layer that turns **accessible, user-authorized WeChat information** into a working surface for:

- `Ask`: ask questions about your WeChat world
- `Find`: locate messages, files, links, and opportunities
- `Digest`: compress a noisy day into the 10 things that matter
- `Act`: draft or queue actions with approval gates
- `Automate`: define long-term filters and routines

## Positioning

> DeepSeek for WeChat — Read everything that matters. Do what needs to be done.

Chinese:

> 让 DeepSeek 接管你的微信信息工作。

This product does **not** claim unsupported powers such as silently reading all historical private chats, traversing every group, or bulk fetching every article from all followed public accounts. The first version stays inside a safer boundary:

- content the user forwards to the agent
- official bot-channel events that are actually delivered
- public links the user authorizes the agent to fetch
- files, images, PDFs, spreadsheets, and voice notes the user explicitly provides

## What ships in this repository

- A publishable `dsh` plugin entry at [`src/index.js`](./src/index.js)
- Ranking, digest, reply, and opportunity extraction logic in [`src/domain.js`](./src/domain.js)
- A clear action-policy gate in [`src/policy.js`](./src/policy.js)
- A built-in mock data mode for product demos in [`src/fixtures.js`](./src/fixtures.js)
- A polished command-center demo in [`web/index.html`](./web/index.html)
- A sample `dsh` overlay in [`examples/cordis.patch.yml`](./examples/cordis.patch.yml)

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
- a `bridge` mode is prepared for a real WeChat connector to supply accessible objects later

## Install

After publishing this package:

```sh
pnpm add dsh-plugin-deepseek-wechat-operator
```

Then add the overlay from [`examples/cordis.patch.yml`](./examples/cordis.patch.yml) to your `dsh` profile.

## Local validation

```sh
node --test
node ./src/demo.js
```

## Repo publishing checklist

- Create a public GitHub repository
- Add the `dsh-plugin` topic
- Publish the npm package publicly
- Include screenshots from `web/index.html`
- Document the supported data boundary clearly
- Do not market unsupported personal-WeChat powers

## Docs

- Product brief: [`docs/product.md`](./docs/product.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- Roadmap: [`docs/roadmap.md`](./docs/roadmap.md)

