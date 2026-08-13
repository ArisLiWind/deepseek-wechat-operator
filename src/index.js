import z from "@deepseek-ai/schemastery"
import { defineTool } from "@deepseek-ai/dsh-tools"
import { buildDailyDigest, extractOpportunities, planAutomationRule, prepareReply, rankReplyCandidates, searchItems } from "./domain.js"
import { WechatOperatorBridge } from "./bridge-service.js"
import { getDemoFixtures } from "./fixtures.js"
import { buildApprovalEnvelope } from "./policy.js"

export const name = "deepseek-wechat-operator"
export const inject = ["tools", "systemPrompt"]

export const Config = z.object({
  mode: z.union([z.const("mock"), z.const("bridge")]).default("mock"),
  digestLimit: z.number().default(10),
  minimumScore: z.number().default(0.45),
  bridgeUrl: z.string().default(""),
  bridgeApiKey: z.string().default(""),
  bridgeStoragePath: z.string().default("")
})

// dsh-tools requires every tool to declare an `output.render`, which turns the
// validated canonical value into model-facing content blocks. A pretty-printed
// JSON text block is the honest default here: the model reads the whole object.
function renderAsJson(_args, value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }]
}

let cachedBridge = null
let cachedBridgeKey = ""

function mockSender() {
  return {
    async sendText({ toUserId, text }) {
      return {
        id: `outbound-${Date.now()}`,
        type: "send_message",
        toUserId,
        text,
        mode: "record-only",
        delivered: false,
        note: "mock mode: no bridge wired, reply not sent",
        createdAt: new Date().toISOString()
      }
    }
  }
}

async function resolveBridge(config, ctx) {
  if (config.mode === "bridge" && ctx.wechatOperatorBridge?.listAccessibleItems) {
    return {
      listItems: () => ctx.wechatOperatorBridge.listAccessibleItems(),
      sendText: options => ctx.wechatOperatorBridge.sendText(options)
    }
  }

  if (config.mode === "bridge") {
    const nextKey = JSON.stringify([config.bridgeUrl, config.bridgeApiKey, config.bridgeStoragePath])
    if (!cachedBridge || cachedBridgeKey !== nextKey) {
      cachedBridge = new WechatOperatorBridge({
        baseUrl: config.bridgeUrl || undefined,
        apiKey: config.bridgeApiKey || undefined,
        storagePath: config.bridgeStoragePath || undefined
      })
      cachedBridgeKey = nextKey
    }
    return {
      listItems: () => cachedBridge.listAccessibleItems(),
      sendText: options => cachedBridge.sendText(options)
    }
  }

  const mock = mockSender()
  return {
    listItems: async () => getDemoFixtures(),
    sendText: options => mock.sendText(options)
  }
}

async function resolveItems(config, ctx) {
  const bridge = await resolveBridge(config, ctx)
  return bridge.listItems()
}

export function apply(ctx, config) {
  ctx.systemPrompt.section({
    name: "wechat-operator",
    order: 500,
    text: `You are the user's 微信总管 (WeChat butler). When the user says "总管帮我看一下微信", "总管，看下微信", or anything asking you to review or handle their WeChat, drive this flow with the wechat_* tools:

1. wechat_digest_world — surface today's most important items.
2. wechat_rank_replies — rank who is most worth replying to.
3. wechat_prepare_reply — draft a reply for the top candidate.
4. wechat_send_message — actually send, and ONLY after the user explicitly approves the exact text (pass confirm:true). Never send automatically.

Hard rule: sending is a Yellow action. Always confirm the exact message text with the user first. Read-only tools (digest/find/rank/prepare) may run immediately.`
  })

  ctx.tools.register(defineTool({
    name: "wechat_digest_world",
    description: "Compress accessible WeChat content into the most important items for the user today.",
    parameters: {
      query: { type: "string", description: "Optional focus such as AI Agent startup or fundraising." },
      limit: { type: "integer", description: "Maximum number of returned items." }
    },
    async execute(args) {
      const items = await resolveItems(config, ctx)
      const digest = buildDailyDigest(items, {
        limit: args.limit ?? config.digestLimit,
        minimumScore: config.minimumScore,
        interests: args.query ? [args.query] : undefined
      })
      return {
        items: digest,
        count: digest.length,
        outlook: "This is a ranked compression of accessible content, not a claim of full WeChat visibility."
      }
    },
    presentCall: args => ({ card: "generic", title: "Digest WeChat world", kind: "other", rawInput: args }),
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          count: { type: "integer", required: true },
          outlook: { type: "string", required: true },
          items: { type: "array", required: true }
        }
      },
      render: renderAsJson
    }
  }))

  ctx.tools.register(defineTool({
    name: "wechat_find",
    description: "Find articles, files, people, messages, and opportunities in the accessible WeChat surface.",
    parameters: {
      query: { type: "string", description: "Search phrase such as Shenzhen agent job or PDF from Lao Wang.", required: true },
      type: { type: "string", description: "Optional filter: article, file, message, opportunity." }
    },
    async execute(args) {
      const results = searchItems(await resolveItems(config, ctx), args.query, { type: args.type })
        .slice(0, 10)
        .map(item => ({
          id: item.id,
          title: item.title ?? item.sender ?? item.id,
          type: item.type,
          source: item.source ?? item.sender ?? "Unknown",
          hint: item.fileName ?? item.url ?? item.contactId ?? item.id
        }))
      return { query: args.query, count: results.length, results }
    },
    presentCall: args => ({ card: "generic", title: "Find in WeChat", kind: "other", rawInput: args }),
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", required: true },
          count: { type: "integer", required: true },
          results: { type: "array", required: true }
        }
      },
      render: renderAsJson
    }
  }))

  ctx.tools.register(defineTool({
    name: "wechat_rank_replies",
    description: "Rank which people are most worth replying to next.",
    parameters: {
      limit: { type: "integer", description: "Maximum number of people to rank." }
    },
    async execute(args) {
      const results = rankReplyCandidates(await resolveItems(config, ctx), { limit: args.limit ?? 5 })
      return { count: results.length, results }
    },
    presentCall: args => ({ card: "generic", title: "Rank replies", kind: "other", rawInput: args }),
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          count: { type: "integer", required: true },
          results: { type: "array", required: true }
        }
      },
      render: renderAsJson
    }
  }))

  ctx.tools.register(defineTool({
    name: "wechat_prepare_reply",
    description: "Draft a reply for a chosen message and classify whether sending it requires approval.",
    parameters: {
      targetId: { type: "string", description: "The item id to reply to.", required: true },
      goal: { type: "string", description: "What the reply should accomplish." },
      constraints: {
        type: "array",
        items: { type: "string" },
        description: "Specific things the draft should ask or avoid."
      }
    },
    async execute(args) {
      const reply = prepareReply(await resolveItems(config, ctx), args.targetId, args.goal, args.constraints ?? [])
      const approval = buildApprovalEnvelope({
        type: "send_message",
        targetId: args.targetId,
        draft: reply.draft
      })
      return { reply, approval }
    },
    presentCall: args => ({ card: "generic", title: "Prepare reply", kind: "other", rawInput: args }),
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          reply: { type: "object", additionalProperties: true, required: true },
          approval: { type: "object", additionalProperties: true, required: true }
        }
      },
      render: renderAsJson
    }
  }))

  ctx.tools.register(defineTool({
    name: "wechat_plan_automation",
    description: "Turn a natural-language filter intent into a durable automation rule draft.",
    parameters: {
      name: { type: "string", description: "Rule name.", required: true },
      includeKeywords: {
        type: "array",
        items: { type: "string" },
        description: "Keywords to keep."
      },
      excludeKeywords: {
        type: "array",
        items: { type: "string" },
        description: "Keywords or sources to filter out."
      },
      action: { type: "string", description: "Action such as save_and_digest." }
    },
    async execute(args) {
      const rule = planAutomationRule(args)
      const opportunities = extractOpportunities(await resolveItems(config, ctx))
      return {
        rule,
        exampleOpportunityCount: opportunities.length
      }
    },
    presentCall: args => ({ card: "generic", title: "Plan automation", kind: "other", rawInput: args }),
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          rule: { type: "object", additionalProperties: true, required: true },
          exampleOpportunityCount: { type: "integer", required: true }
        }
      },
      render: renderAsJson
    }
  }))

  ctx.tools.register(defineTool({
    name: "wechat_send_message",
    description: "Dispatch a text reply through the wired WeChat bridge. Yellow-gated: without confirm=true it only returns the approval envelope; even with confirm=true it transmits only when a real iLink/ClawBot gateway is wired, otherwise it records the intent without sending.",
    parameters: {
      targetId: { type: "string", description: "The item id to reply to; its contactId is the recipient.", required: true },
      text: { type: "string", description: "Exact message text to send.", required: true },
      confirm: { type: "boolean", description: "Set true to actually dispatch; otherwise the tool only drafts + returns the approval envelope." }
    },
    async execute(args) {
      const bridge = await resolveBridge(config, ctx)
      const items = await bridge.listItems()
      const item = items.find(candidate => candidate.id === args.targetId)
      if (!item) {
        throw new Error(`Unknown reply target: ${args.targetId}`)
      }
      const toUserId = item.contactId ?? item.senderId ?? item.id
      const approval = buildApprovalEnvelope({
        type: "send_message",
        targetId: args.targetId,
        toUserId,
        draft: args.text
      })

      if (!args.confirm) {
        return {
          sent: false,
          approval,
          result: null,
          note: "Yellow gate: confirm=true is required to dispatch."
        }
      }

      const result = await bridge.sendText({ toUserId, text: args.text })
      return {
        sent: result.delivered === true,
        approval,
        result,
        note: result.delivered === true ? "" : "record-only: no live gateway wired, reply not transmitted"
      }
    },
    presentCall: args => ({ card: "generic", title: "Send WeChat reply", kind: "other", rawInput: args }),
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          sent: { type: "boolean", required: true },
          approval: { type: "object", additionalProperties: true, required: true },
          result: { type: "json" },
          note: { type: "string", required: true }
        }
      },
      render: renderAsJson
    }
  }))
}
