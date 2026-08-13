import path from "node:path"
import { normalizeInboundPayload } from "./normalize.js"
import { BridgeStore } from "./store.js"
import { createOutbound } from "./outbound.js"

const DEFAULT_STORAGE_PATH = path.resolve(process.cwd(), ".deepseek-wechat-operator", "bridge-state.json")

async function parseJson(response) {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Bridge HTTP ${response.status}: ${body}`)
  }
  return response.json()
}

export class WechatOperatorBridge {
  constructor(options = {}) {
    this.options = options
    this.store = new BridgeStore(options.storagePath ?? DEFAULT_STORAGE_PATH)
    this.outbound = options.outbound ?? createOutbound(options.outboundMode, {
      ...options.outboundOptions,
      store: this.store
    })
    this.ready = false
  }

  async init() {
    if (!this.ready) {
      await this.store.load()
      this.ready = true
    }
    return this
  }

  async listAccessibleItems() {
    await this.init()

    if (this.options.baseUrl) {
      const response = await fetch(new URL("/items", this.options.baseUrl), {
        headers: buildHeaders(this.options.apiKey)
      })
      const payload = await parseJson(response)
      return payload.items
    }

    return this.store.listItems()
  }

  async ingest(payload) {
    await this.init()
    const normalized = normalizeInboundPayload(payload)
    await this.store.appendNormalized(normalized)
    return normalized
  }

  async sendText({ toUserId, text }) {
    await this.init()

    if (this.options.baseUrl) {
      const response = await fetch(new URL("/actions/send-text", this.options.baseUrl), {
        method: "POST",
        headers: {
          ...buildHeaders(this.options.apiKey),
          "content-type": "application/json"
        },
        body: JSON.stringify({ toUserId, text })
      })
      return parseJson(response)
    }

    const contextToken = this.store.getContextToken(toUserId)
    if (!contextToken) {
      throw new Error(`No cached context_token for ${toUserId}`)
    }
    return this.outbound.sendText({ toUserId, text, contextToken })
  }
}

function buildHeaders(apiKey) {
  if (!apiKey) return {}
  return { authorization: `Bearer ${apiKey}` }
}
