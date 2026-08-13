import z from "@deepseek-ai/schemastery"
import { defineTool } from "@deepseek-ai/dsh-tools"
import { buildDailyDigest, extractOpportunities, planAutomationRule, prepareReply, rankReplyCandidates, searchItems } from "./domain.js"
import { getDemoFixtures } from "./fixtures.js"
import { buildApprovalEnvelope } from "./policy.js"

export const name = "deepseek-wechat-operator"
export const inject = ["tools"]

export const Config = z.object({
  mode: z.union([z.const("mock"), z.const("bridge")]).default("mock"),
  digestLimit: z.number().default(10),
  minimumScore: z.number().default(0.45)
})

function resolveItems(config, ctx) {
  if (config.mode === "bridge" && ctx.wechatOperatorBridge?.listAccessibleItems) {
    return ctx.wechatOperatorBridge.listAccessibleItems()
  }
  return getDemoFixtures()
}

export function apply(ctx, config) {
  ctx.tools.register(defineTool({
    name: "wechat_digest_world",
    description: "Compress accessible WeChat content into the most important items for the user today.",
    parameters: {
      query: { type: "string", description: "Optional focus such as AI Agent startup or fundraising.", required: false },
      limit: { type: "integer", description: "Maximum number of returned items.", required: false }
    },
    execute(args) {
      const items = resolveItems(config, ctx)
      const digest = buildDailyDigest(items, {
        limit: args.limit ?? config.digestLimit,
        minimumScore: config.minimumScore,
        interests: args.query ? [args.query] : undefined
      })
      return Promise.resolve({
        items: digest,
        count: digest.length,
        outlook: "This is a ranked compression of accessible content, not a claim of full WeChat visibility."
      })
    },
    presentCall: args => ({ card: "generic", title: "Digest WeChat world", kind: "other", rawInput: args }),
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          count: { type: "integer", required: true },
          outlook: { type: "string", required: true },
          items: {
            type: "array",
            required: true,
            items: { type: "object" }
          }
        }
      }
    }
  }))

  ctx.tools.register(defineTool({
    name: "wechat_find",
    description: "Find articles, files, people, messages, and opportunities in the accessible WeChat surface.",
    parameters: {
      query: { type: "string", description: "Search phrase such as Shenzhen agent job or PDF from Lao Wang.", required: true },
      type: { type: "string", description: "Optional filter: article, file, message, opportunity.", required: false }
    },
    execute(args) {
      const results = searchItems(resolveItems(config, ctx), args.query, { type: args.type })
        .slice(0, 10)
        .map(item => ({
          id: item.id,
          title: item.title ?? item.sender ?? item.id,
          type: item.type,
          source: item.source ?? item.sender ?? "Unknown",
          hint: item.fileName ?? item.url ?? item.contactId ?? item.id
        }))
      return Promise.resolve({ query: args.query, count: results.length, results })
    },
    presentCall: args => ({ card: "generic", title: "Find in WeChat", kind: "other", rawInput: args })
  }))

  ctx.tools.register(defineTool({
    name: "wechat_rank_replies",
    description: "Rank which people are most worth replying to next.",
    parameters: {
      limit: { type: "integer", description: "Maximum number of people to rank.", required: false }
    },
    execute(args) {
      const results = rankReplyCandidates(resolveItems(config, ctx), { limit: args.limit ?? 5 })
      return Promise.resolve({ count: results.length, results })
    },
    presentCall: args => ({ card: "generic", title: "Rank replies", kind: "other", rawInput: args })
  }))

  ctx.tools.register(defineTool({
    name: "wechat_prepare_reply",
    description: "Draft a reply for a chosen message and classify whether sending it requires approval.",
    parameters: {
      targetId: { type: "string", description: "The item id to reply to.", required: true },
      goal: { type: "string", description: "What the reply should accomplish.", required: false },
      constraints: {
        type: "array",
        required: false,
        items: { type: "string" },
        description: "Specific things the draft should ask or avoid."
      }
    },
    execute(args) {
      const reply = prepareReply(resolveItems(config, ctx), args.targetId, args.goal, args.constraints ?? [])
      const approval = buildApprovalEnvelope({
        type: "send_message",
        targetId: args.targetId,
        draft: reply.draft
      })
      return Promise.resolve({ reply, approval })
    },
    presentCall: args => ({ card: "generic", title: "Prepare reply", kind: "other", rawInput: args })
  }))

  ctx.tools.register(defineTool({
    name: "wechat_plan_automation",
    description: "Turn a natural-language filter intent into a durable automation rule draft.",
    parameters: {
      name: { type: "string", description: "Rule name.", required: true },
      includeKeywords: {
        type: "array",
        required: false,
        items: { type: "string" },
        description: "Keywords to keep."
      },
      excludeKeywords: {
        type: "array",
        required: false,
        items: { type: "string" },
        description: "Keywords or sources to filter out."
      },
      action: { type: "string", description: "Action such as save_and_digest.", required: false }
    },
    execute(args) {
      const rule = planAutomationRule(args)
      const opportunities = extractOpportunities(resolveItems(config, ctx))
      return Promise.resolve({
        rule,
        exampleOpportunityCount: opportunities.length
      })
    },
    presentCall: args => ({ card: "generic", title: "Plan automation", kind: "other", rawInput: args })
  }))
}

