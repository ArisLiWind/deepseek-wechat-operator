import test from "node:test"
import assert from "node:assert/strict"
import { computeSocial, inferSelf, matchInterests, normalizeRecords } from "../src/social.js"

const DAY = 86400000

test("normalizeRecords accepts tolerant field names and wrappers", () => {
  const records = normalizeRecords({
    messages: [
      { sender: "张三", receiver: "我", content: "hi", time: 1000 },
      { from: "李四", to: "我", text: "在吗", ts: 2000 }
    ]
  })
  assert.equal(records.length, 2)
  assert.equal(records[0].from, "张三")
  assert.equal(records[0].text, "hi")
  assert.equal(records[1].ts, 2000)
})

test("inferSelf picks the most frequent party", () => {
  const self = inferSelf([
    { from: "我", to: "张三" },
    { from: "我", to: "李四" },
    { from: "张三", to: "我" }
  ])
  assert.equal(self, "我")
})

test("computeSocial ranks contacts and flags who has gone quiet", () => {
  const now = Date.now()
  const data = [
    { from: "张三", to: "我", text: "最近怎么样", ts: now - 1 * DAY },
    { from: "我", to: "张三", text: "还行", ts: now - 1 * DAY },
    { from: "李四", to: "我", text: "好久不见", ts: now - 100 * DAY }
  ]
  const r = computeSocial(data, { self: "我", now })
  assert.equal(r.contactCount, 2)
  const zhang = r.contacts.find(c => c.name === "张三")
  const li = r.contacts.find(c => c.name === "李四")
  assert.equal(zhang.total, 2)
  assert.equal(zhang.daysSinceLast, 1)
  assert.equal(li.daysSinceLast, 100)
  assert.equal(r.mostInactive[0].name, "李四")
})

test("interest profile is extracted from the OTHER person's messages only", () => {
  const now = Date.now()
  const data = [
    { from: "张三", to: "我", text: "最近股票行情不错想加仓，关注一下人工智能大模型", ts: now },
    { from: "我", to: "张三", text: "我也觉得 deepseek 值得关注", ts: now }
  ]
  const r = computeSocial(data, { self: "我", now })
  const zhang = r.contacts.find(c => c.name === "张三")
  const tags = zhang.interests.map(i => i.tag)
  assert.ok(tags.includes("投资理财"))
  assert.ok(tags.includes("AI/科技"))
})

test("matchInterests is case-insensitive for latin keywords", () => {
  const hits = matchInterests("DeepSeek OpenAI GPT")
  assert.ok(hits["AI/科技"] >= 3)
})
