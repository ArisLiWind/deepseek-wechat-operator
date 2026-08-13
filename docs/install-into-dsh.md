# Installing the plugin into dsh

This plugin (`dsh-plugin-deepseek-wechat-operator`) is a standard dsh plugin:
it exports `apply(ctx, config)` and registers its tools on `ctx.tools`. To make
it available to an agent, you mount it into an agent preset's composition.

dsh composes each agent from an **agent preset** (`agent.cordis.yml`), and
layers user changes on top via a **profile** directory under the Harness home:

```text
$DSH_HOME/profiles/<profile>/          (DSH_HOME defaults to ~/.dsh)
  package.json        # out-of-tree plugin dependencies + dsh.profile.bundles
  cordis.patch.yml    # YOUR patch layer (hot-reloaded on long-lived surfaces)
  pnpm-workspace.yaml
```

The user patch layer is the one you edit — it is the same `- insert:` patch
format this repo already ships in `examples/cordis.bridge.patch.yml`.

## Prerequisites

- Node.js >= 22 (the plugin itself).
- A dsh installation with a profile (the shipped `web` / `headless` profiles
  exist after first run).

## Steps

### 1. Make the package resolvable from the profile

The plugin is not published to npm, so install it from this checkout:

```sh
dsh plugin --profile web add file:/absolute/path/to/deepseek-wechat-operator
```

(`dsh plugin` writes the package into the profile's `package.json` and runs
pnpm install inside the profile directory. The profile's pnpm-workspace.yaml
hoists peers so the plugin shares the installation's single `cordis`/
`@deepseek-ai/*` instances instead of a duplicate.)

If `dsh plugin` is not available, the equivalent manual wiring is:

```sh
cd "$DSH_HOME/profiles/web"           # mkdir -p it first if absent
pnpm add file:/absolute/path/to/deepseek-wechat-operator
```

### 2. Add the patch layer

Copy `integration/agent.cordis.patch.yml` into the profile's patch file, or
append its `- insert:` block to an existing `cordis.patch.yml`:

```sh
cp integration/agent.cordis.patch.yml "$DSH_HOME/profiles/web/cordis.patch.yml"
```

Use `mode: mock` first if you only want to smoke-test the five read/rank/draft
tools against the built-in demo fixtures (no other service needed).

### 3. Start the bridge (bridge mode only)

```sh
cd deepseek-wechat-operator
WECHAT_OPERATOR_API_KEY=demo-key npm run bridge:dev
```

It listens on `http://127.0.0.1:3468`. The patch's `bridgeApiKey` must match.

### 4. Reload / verify

The user patch layer is hot-reloaded on long-lived surfaces; if your session
does not pick the new tools up, restart the dsh process (a restart is required
for a *new* profile's package dependency to load, since the plugin module is
imported at mount time).

You should now see, in the agent's tool catalog:

- `wechat_digest_world`
- `wechat_find`
- `wechat_rank_replies`
- `wechat_prepare_reply`
- `wechat_plan_automation`
- `wechat_send_message`

## Honest scope note

Mounting this plugin gives the agent a read/rank/draft layer and a
**Yellow-gated** `wechat_send_message` tool. Outbound sends only actually
transmit when a real iLink/ClawBot gateway is wired behind the bridge — see
`docs/use-with-ilink-gateway.md`. Otherwise outbound is `record-only` (the
reply is persisted to the bridge's action ledger and never sent), on purpose.
