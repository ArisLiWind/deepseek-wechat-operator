import test from "node:test"
import assert from "node:assert/strict"
import { validateJsonSchemaValue } from "@deepseek-ai/dsh-tools"
import { apply, Config } from "../src/index.js"

const EXPECTED_TOOLS = [
  "wechat_digest_world",
  "wechat_find",
  "wechat_rank_replies",
  "wechat_prepare_reply",
  "wechat_plan_automation",
  "wechat_send_message",
  "wechat_desktop_status",
  "wechat_desktop_focus",
  "wechat_desktop_read",
  "wechat_desktop_send"
]

function mountPlugin(config) {
  const tools = []
  const sections = []
  const ctx = {
    tools: { register: tool => tools.push(tool) },
    systemPrompt: { section: section => sections.push(section) }
  }
  apply(ctx, config)
  return { tools, sections }
}

test("Config parses defaults and accepts overrides", () => {
  assert.equal(Config({}).mode, "mock")
  assert.equal(Config({ mode: "bridge" }).mode, "bridge")
  assert.equal(Config({ digestLimit: 3 }).digestLimit, 3)
  assert.equal(Config({ minimumScore: 0.5 }).minimumScore, 0.5)
})

test("apply injects the 微信总管 persona prompt that teaches the trigger", () => {
  const { sections } = mountPlugin(Config({ mode: "mock" }))
  assert.equal(sections.length, 1)
  assert.equal(sections[0].name, "wechat-operator")
  assert.match(sections[0].text, /总管帮我看一下微信/)
  assert.match(sections[0].text, /confirm:true/)
})

test("apply registers all ten tools, each with output.render and output.schema", () => {
  const { tools } = mountPlugin(Config({ mode: "mock" }))
  assert.deepEqual(tools.map(tool => tool.name), EXPECTED_TOOLS)
  for (const tool of tools) {
    assert.equal(typeof tool.output.render, "function", `${tool.name} render is a function`)
    assert.ok(tool.output.schema, `${tool.name} declares an output schema`)
  }
})

test("every mock-mode tool executes and returns schema-valid, renderable output", async () => {
  const { tools } = mountPlugin(Config({ mode: "mock" }))
  const byName = Object.fromEntries(tools.map(tool => [tool.name, tool]))
  const cases = [
    ["wechat_digest_world", {}],
    ["wechat_find", { query: "agent" }],
    ["wechat_rank_replies", {}],
    ["wechat_prepare_reply", { targetId: "message-investor-followup" }],
    ["wechat_plan_automation", { name: "keep funding" }],
    ["wechat_send_message", { targetId: "message-investor-followup", text: "hi" }]
  ]

  for (const [toolName, args] of cases) {
    const tool = byName[toolName]
    const value = await tool.execute(args, {})
    const violations = validateJsonSchemaValue(tool.output.schema, value, "value")
    assert.equal(violations.length, 0, `${toolName} output valid (got: ${violations.join("; ")})`)
    const blocks = tool.output.render(args, value)
    assert.ok(Array.isArray(blocks) && blocks.length > 0, `${toolName} render returns content blocks`)
  }
})

test("wechat_send_message is yellow-gated: no dispatch without confirm", async () => {
  const { tools } = mountPlugin(Config({ mode: "mock" }))
  const send = tools.find(tool => tool.name === "wechat_send_message")
  const value = await send.execute({ targetId: "message-investor-followup", text: "hi" }, {})
  assert.equal(value.sent, false)
  assert.equal(value.result, null)
  assert.equal(value.approval.requiresApproval, true)
  assert.equal(value.approval.level, "yellow")
})

test("wechat_send_message with confirm is record-only in mock mode", async () => {
  const { tools } = mountPlugin(Config({ mode: "mock" }))
  const send = tools.find(tool => tool.name === "wechat_send_message")
  const value = await send.execute({ targetId: "message-investor-followup", text: "hi", confirm: true }, {})
  assert.equal(value.sent, false)
  assert.equal(value.result.mode, "record-only")
  assert.equal(value.result.delivered, false)
})

test("wechat_desktop_send is yellow-gated: no dispatch without confirm", async () => {
  const { tools } = mountPlugin(Config({ mode: "mock" }))
  const send = tools.find(tool => tool.name === "wechat_desktop_send")
  const value = await send.execute({ contact: "张三", text: "hi" }, {})
  assert.equal(value.sent, false)
  assert.equal(value.result, null)
  assert.equal(value.approval.requiresApproval, true)
  assert.equal(value.approval.level, "yellow")
  assert.equal(value.approval.action.type, "desktop_send")
})
