import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { normalizeInboundPayload } from "../src/normalize.js"
import { WechatOperatorBridge } from "../src/bridge-service.js"

test("normalizeInboundPayload converts iLink-style text items into accessible items", () => {
  const normalized = normalizeInboundPayload({
    msg: {
      client_id: "msg-01",
      from_user_id: "zoe-capital",
      from_user_name: "Zoe Capital",
      context_token: "CTX-001",
      item_list: [
        {
          type: 1,
          text_item: {
            text: "We liked the deck. Can we discuss your AI agent moat and fundraising timeline?"
          }
        }
      ]
    }
  })

  assert.equal(normalized.accessibleItems.length, 1)
  assert.equal(normalized.accessibleItems[0].sender, "Zoe Capital")
  assert.equal(normalized.accessibleItems[0].contextToken, "CTX-001")
})

test("bridge ingests inbound events and records reply actions when context_token exists", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "dwo-bridge-test-"))

  try {
    const bridge = await new WechatOperatorBridge({
      storagePath: path.join(tmpDir, "state.json")
    }).init()

    await bridge.ingest({
      messageId: "normalized-01",
      sender: "Liu Yan",
      senderId: "liu-yan",
      contextToken: "CTX-LIU-01",
      items: [
        {
          type: "text",
          text: "我们有个深圳 Agent 合作机会，可以这周沟通预算和 timeline 吗？"
        }
      ]
    })

    const items = await bridge.listAccessibleItems()
    assert.equal(items.length, 1)
    assert.equal(items[0].contactId, "liu-yan")

    const outbound = await bridge.sendText({
      toUserId: "liu-yan",
      text: "我有兴趣，先确认预算和时间安排。"
    })

    assert.equal(outbound.mode, "record-only")
    assert.equal(outbound.contextToken, "CTX-LIU-01")
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
})
