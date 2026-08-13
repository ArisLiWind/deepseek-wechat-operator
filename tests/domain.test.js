import test from "node:test"
import assert from "node:assert/strict"
import { buildDailyDigest, planAutomationRule, prepareReply, rankReplyCandidates, searchItems } from "../src/domain.js"
import { getDemoFixtures } from "../src/fixtures.js"

test("daily digest filters low-signal content and ranks high-value items", () => {
  const digest = buildDailyDigest(getDemoFixtures(), { limit: 3 })
  assert.equal(digest.length, 3)
  assert.equal(digest[0].id, "message-investor-followup")
  assert.ok(!digest.some(item => item.id === "article-marketing-funnel"))
})

test("search finds relevant opportunity content", () => {
  const results = searchItems(getDemoFixtures(), "Shenzhen", { type: "opportunity" })
  assert.ok(results.length >= 1)
  assert.equal(results[0].id, "job-shenzhen-operator")
})

test("reply ranking prioritizes urgent, high-value threads", () => {
  const replies = rankReplyCandidates(getDemoFixtures(), { limit: 2 })
  assert.equal(replies[0].sender, "Zoe Capital")
  assert.equal(replies[1].sender, "Liu Yan")
})

test("prepareReply drafts a budget-and-timeline qualification reply", () => {
  const reply = prepareReply(getDemoFixtures(), "person-liu-bd", "qualify the partnership", ["ask for budget", "ask for timeline"])
  assert.match(reply.draft, /budget range/i)
  assert.match(reply.draft, /timeline/i)
})

test("automation rule keeps include and exclude keywords", () => {
  const rule = planAutomationRule({
    name: "agent-signal",
    includeKeywords: ["DeepSeek Agent", "Agent支付"],
    excludeKeywords: ["营销"]
  })
  assert.deepEqual(rule.includeKeywords, ["DeepSeek Agent", "Agent支付"])
  assert.deepEqual(rule.excludeKeywords, ["营销"])
})

