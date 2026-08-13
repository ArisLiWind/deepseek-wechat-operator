import test from "node:test"
import assert from "node:assert/strict"
import { normalizeInboundPayload } from "../src/normalize.js"

test("normalizes a raw WeixinMessage (weixin-ilink-gateway webhook push)", () => {
  const normalized = normalizeInboundPayload({
    seq: 42,
    message_id: "real-msg-001",
    from_user_id: "alice@im.wechat",
    from_user_name: "Alice",
    create_time_ms: 1789290000000,
    item_list: [
      { type: 1, text_item: { text: "预算范围是多少？" } }
    ],
    context_token: "CTX-REAL-001"
  })

  assert.equal(normalized.message.messageId, "real-msg-001")
  assert.equal(normalized.message.channel, "ilink")
  assert.equal(normalized.message.contextToken, "CTX-REAL-001")
  assert.equal(normalized.accessibleItems.length, 1)
  assert.equal(normalized.accessibleItems[0].sender, "Alice")
  assert.equal(normalized.accessibleItems[0].contactId, "alice@im.wechat")
  assert.equal(normalized.accessibleItems[0].type, "message")
})

test("normalizes WeixinMessage file/image/video item types", () => {
  const normalized = normalizeInboundPayload({
    message_id: "real-msg-002",
    from_user_id: "bob@im.wechat",
    from_user_name: "Bob",
    context_token: "CTX-REAL-002",
    item_list: [
      { type: 2, image_item: { media: { full_url: "https://cdn/1.jpg" } } },
      { type: 4, file_item: { file_name: "deck.pdf" } },
      { type: 5, video_item: { media: { full_url: "https://cdn/2.mp4" } } }
    ]
  })

  assert.equal(normalized.accessibleItems.length, 3)
  assert.equal(normalized.accessibleItems[0].mediaType, "image")
  assert.equal(normalized.accessibleItems[1].type, "file")
  assert.equal(normalized.accessibleItems[1].fileName, "deck.pdf")
  assert.equal(normalized.accessibleItems[2].mediaType, "video")
})

test("falls back to a friendly label when the WeixinMessage has no display name", () => {
  const normalized = normalizeInboundPayload({
    message_id: "real-msg-003",
    from_user_id: "o9cq805gvZ-LPhxQJl_jsQPMKodM@im.wechat",
    context_token: "CTX-REAL-003",
    item_list: [{ type: 1, text_item: { text: "hi" } }]
  })

  assert.equal(normalized.accessibleItems[0].sender, "微信联系人(o9cq80…)")
  assert.equal(normalized.accessibleItems[0].contactId, "o9cq805gvZ-LPhxQJl_jsQPMKodM@im.wechat")
})
