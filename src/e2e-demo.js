import { once } from "node:events"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { WechatOperatorBridge } from "./bridge-service.js"
import { buildDailyDigest } from "./domain.js"

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "dwo-bridge-"))

try {
  const bridge = await new WechatOperatorBridge({
    storagePath: path.join(tmpDir, "state.json")
  }).init()

  await bridge.ingest({
    msg: {
      client_id: "demo-msg-001",
      from_user_id: "liu-yan",
      from_user_name: "Liu Yan",
      context_token: "CTX-DEMO-001",
      item_list: [
        {
          type: 1,
          text_item: {
            text: "我们在看 9 月深圳 Agent 创业营合作机会，这周能聊一下预算和时间吗？"
          }
        }
      ]
    }
  })

  const items = await bridge.listAccessibleItems()
  const digest = buildDailyDigest(items, { limit: 1 })
  const outbound = await bridge.sendText({
    toUserId: "liu-yan",
    text: "我有兴趣，先确认预算范围和时间安排。"
  })

  console.log(JSON.stringify({
    itemsCount: items.length,
    topDigest: digest[0],
    outboundMode: outbound.mode
  }, null, 2))
} finally {
  await rm(tmpDir, { recursive: true, force: true })
}
