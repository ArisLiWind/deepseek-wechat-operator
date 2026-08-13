/**
 * Outbound adapters: the only place a message leaves the process.
 *
 * The bridge keeps a hard split between "inbound" (webhook → normalized items)
 * and "outbound" (a reply the operator wants dispatched). Outbound is an
 * adapter because the repo itself ships no WeChat transport — a real reply
 * needs a gateway that actually speaks iLink/ClawBot to WeChat. Until that
 * gateway is wired, outbound is `record-only`: the reply is persisted to the
 * action ledger and never transmitted. That default exists on purpose so the
 * repo never pretends to have sent something it did not.
 */

/**
 * The safe default. Records the outbound action in the bridge store and
 * returns it with `delivered: false`. No network, no WeChat.
 */
export class RecordOnlyOutbound {
  constructor(store) {
    this.store = store
  }

  get mode() {
    return "record-only"
  }

  async sendText({ toUserId, text, contextToken }) {
    const action = {
      id: `outbound-${Date.now()}`,
      type: "send_message",
      toUserId,
      text,
      contextToken,
      mode: this.mode,
      delivered: false,
      createdAt: new Date().toISOString()
    }
    await this.store.recordOutboundAction(action)
    return action
  }
}

/**
 * Default request body for an iLink-style gateway reply, matching the
 * `weixin-ilink-gateway` `POST /messages/send` contract (and Tencent's own
 * `@tencent-weixin/openclaw-weixin` shape):
 *
 *   { "to": "<user_id>", "items": [{ "type": "text", "text": "hi" }], "context_token": "..." }
 *
 * `context_token` is the routing invariant every iLink reply keeps; the
 * gateway uses it to address the originating conversation. Override with
 * `buildBody` when your gateway uses different field names.
 */
export function defaultIlkBody({ toUserId, text, contextToken }) {
  const body = { to: toUserId, context_token: contextToken, items: [{ type: "text", text }] }
  return body
}

/**
 * Dispatches a reply to a real HTTP gateway (whatever process you run that
 * actually speaks to WeChat). `url` is the gateway's send endpoint. The reply
 * is marked delivered only when the gateway answers 2xx.
 */
export class HttpGatewayOutbound {
  constructor(options = {}) {
    if (!options.url) {
      throw new Error("HttpGatewayOutbound requires a gateway url")
    }
    this.url = options.url
    this.apiKey = options.apiKey ?? ""
    this.headers = options.headers ?? {}
    this.buildBody = options.buildBody ?? defaultIlkBody
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
  }

  get mode() {
    return "ilink-gateway"
  }

  async sendText({ toUserId, text, contextToken }) {
    if (!contextToken) {
      throw new Error(`No context_token to reply to ${toUserId ?? "unknown user"}`)
    }
    const headers = { "content-type": "application/json", ...this.headers }
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`

    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify(this.buildBody({ toUserId, text, contextToken }))
    })

    const delivered = response.ok
    const action = {
      id: `outbound-${Date.now()}`,
      type: "send_message",
      toUserId,
      text,
      contextToken,
      mode: this.mode,
      delivered,
      gatewayStatus: response.status,
      createdAt: new Date().toISOString()
    }

    if (!delivered) {
      const body = await response.text()
      action.gatewayError = body.slice(0, 500)
    }
    return action
  }
}

/**
 * Build the outbound adapter named by `mode`. `record-only` (the default) and
 * anything unrecognized both fall back to {@link RecordOnlyOutbound}, so a
 * typo in configuration can never accidentally enable a live send.
 */
export function createOutbound(mode, options = {}) {
  if (mode === "ilink-gateway") {
    return new HttpGatewayOutbound(options)
  }
  return new RecordOnlyOutbound(options.store)
}
