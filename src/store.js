import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const DEFAULT_STATE = {
  messages: [],
  items: [],
  contextTokens: {},
  outboundActions: []
}

export class BridgeStore {
  constructor(storagePath) {
    this.storagePath = storagePath
    this.state = structuredClone(DEFAULT_STATE)
  }

  async load() {
    await mkdir(path.dirname(this.storagePath), { recursive: true })
    try {
      const text = await readFile(this.storagePath, "utf8")
      this.state = { ...structuredClone(DEFAULT_STATE), ...JSON.parse(text) }
    } catch (error) {
      if (error.code !== "ENOENT") throw error
      await this.flush()
    }
    return this.state
  }

  async flush() {
    await writeFile(this.storagePath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8")
  }

  listItems() {
    return [...this.state.items].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
  }

  listOutboundActions() {
    return [...this.state.outboundActions]
  }

  async appendNormalized(result) {
    this.state.messages.push(result.message)
    this.state.items.push(...result.accessibleItems)
    if (result.message.contextToken && result.message.senderId) {
      this.state.contextTokens[result.message.senderId] = result.message.contextToken
    }
    await this.flush()
    return result.accessibleItems.length
  }

  getContextToken(userId) {
    return this.state.contextTokens[userId] ?? null
  }

  async recordOutboundAction(action) {
    this.state.outboundActions.push(action)
    await this.flush()
    return action
  }
}
