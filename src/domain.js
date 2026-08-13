const DEFAULT_INTERESTS = [
  "ai agent",
  "agent payments",
  "ai social",
  "agent operator",
  "startup",
  "fundraising"
]

const LOW_SIGNAL_SOURCES = new Set([
  "Growth Rocket"
])

function containsKeyword(text, keywords) {
  const normalized = String(text ?? "").toLowerCase()
  return keywords.some(keyword => normalized.includes(keyword.toLowerCase()))
}

function computeInterestScore(item, interests) {
  const haystack = [
    item.title,
    item.body,
    item.summary,
    ...(item.topics ?? [])
  ].join(" ")
  const hits = interests.filter(interest => containsKeyword(haystack, [interest])).length
  return interests.length === 0 ? 0 : hits / interests.length
}

function computeTypeBoost(type) {
  if (type === "message") return 0.12
  if (type === "opportunity") return 0.14
  if (type === "file") return 0.1
  return 0.08
}

export function scoreItem(item, options = {}) {
  const interests = options.interests ?? DEFAULT_INTERESTS
  const sourcePenalty = LOW_SIGNAL_SOURCES.has(item.source) ? -0.25 : 0
  const interestScore = computeInterestScore(item, interests)
  const score =
    (item.qualityScore ?? 0) * 0.25 +
    (item.noveltyScore ?? 0) * 0.2 +
    (item.businessValueScore ?? 0) * 0.25 +
    (item.relationshipScore ?? 0) * 0.15 +
    (item.urgencyScore ?? 0) * 0.07 +
    interestScore * 0.08 +
    computeTypeBoost(item.type) +
    sourcePenalty

  return {
    ...item,
    interestScore,
    totalScore: Number(score.toFixed(4))
  }
}

export function dedupeItems(items) {
  const byGroup = new Map()
  for (const item of items) {
    const key = item.duplicateGroup ?? item.id
    const existing = byGroup.get(key)
    if (!existing || (item.totalScore ?? 0) > (existing.totalScore ?? 0)) {
      byGroup.set(key, item)
    }
  }
  return [...byGroup.values()]
}

export function buildDailyDigest(items, options = {}) {
  const limit = options.limit ?? 10
  const scored = items
    .map(item => scoreItem(item, options))
    .filter(item => item.totalScore >= (options.minimumScore ?? 0.45))
  const deduped = dedupeItems(scored)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit)

  return deduped.map((item, index) => ({
    rank: index + 1,
    id: item.id,
    title: item.title ?? item.sender ?? item.fileName ?? item.id,
    type: item.type,
    source: item.source ?? item.sender ?? "Unknown",
    publishedAt: item.publishedAt,
    why: item.why ?? "High signal based on quality, relevance, and urgency.",
    summary: buildThreeLineSummary(item),
    totalScore: item.totalScore,
    original: item.url ?? item.fileName ?? item.contactId ?? item.id
  }))
}

export function buildThreeLineSummary(item) {
  const lines = [
    item.summary ?? item.body ?? item.title ?? "",
    `Signal: quality ${Math.round((item.qualityScore ?? 0) * 100)} / novelty ${Math.round((item.noveltyScore ?? 0) * 100)} / value ${Math.round((item.businessValueScore ?? 0) * 100)}`,
    item.deadline ? `Deadline: ${item.deadline}` : `Access: ${item.accessibleVia ?? "unknown"}`
  ]
  return lines.slice(0, 3)
}

export function searchItems(items, query, options = {}) {
  const q = String(query ?? "").trim().toLowerCase()
  const type = options.type
  return items
    .filter(item => !type || item.type === type)
    .map(item => {
      const haystack = [
        item.title,
        item.body,
        item.summary,
        item.sender,
        item.source,
        ...(item.topics ?? [])
      ].join(" ").toLowerCase()
      const hits = q.length === 0 ? 0 : haystack.split(q).length - 1
      return { ...item, queryHits: hits, totalScore: scoreItem(item, options).totalScore }
    })
    .filter(item => q.length === 0 || item.queryHits > 0)
    .sort((a, b) => (b.queryHits * 2 + b.totalScore) - (a.queryHits * 2 + a.totalScore))
}

export function rankReplyCandidates(items, options = {}) {
  return items
    .filter(item => item.type === "message")
    .map(item => {
      const replyScore =
        (item.relationshipScore ?? 0) * 0.35 +
        (item.businessValueScore ?? 0) * 0.3 +
        (item.urgencyScore ?? 0) * 0.2 +
        Math.min((item.waitingHours ?? 0) / 12, 1) * 0.15
      return {
        id: item.id,
        sender: item.sender,
        title: item.title ?? item.body?.slice(0, 80) ?? item.id,
        replyScore: Number(replyScore.toFixed(4)),
        reason: buildReplyReason(item)
      }
    })
    .sort((a, b) => b.replyScore - a.replyScore)
    .slice(0, options.limit ?? 5)
}

function buildReplyReason(item) {
  const reasons = []
  if ((item.businessValueScore ?? 0) > 0.8) reasons.push("high commercial value")
  if ((item.relationshipScore ?? 0) > 0.8) reasons.push("strong relationship")
  if ((item.urgencyScore ?? 0) > 0.7) reasons.push("time-sensitive")
  if ((item.waitingHours ?? 0) >= 3) reasons.push("has been waiting")
  return reasons.join(", ") || "worth a thoughtful response"
}

export function prepareReply(items, targetId, goal, constraints = []) {
  const item = items.find(candidate => candidate.id === targetId)
  if (!item) {
    throw new Error(`Unknown reply target: ${targetId}`)
  }

  const goalLine = goal ?? "show interest and move the conversation forward"
  const constraintLine = constraints.length > 0
    ? `Also cover: ${constraints.join("; ")}.`
    : ""

  return {
    targetId,
    sender: item.sender,
    draft: `Hi ${item.sender}, thanks for the note. I am interested in this. ${constraintLine} Before we lock anything in, could you share the budget range, expected timeline, and what success would look like from your side?`,
    intent: goalLine
  }
}

export function extractOpportunities(items) {
  return items
    .filter(item => item.type === "opportunity" || containsKeyword(item.body, ["合作", "融资", "比赛", "岗位", "partnership", "fundraising", "job", "competition"]))
    .map(item => ({
      id: item.id,
      title: item.title,
      owner: item.sender ?? item.source ?? "Unknown",
      deadline: item.deadline ?? null,
      category: item.type === "opportunity" ? "opportunity" : "message",
      nextStep: suggestNextStep(item)
    }))
}

function suggestNextStep(item) {
  if (item.deadline) return "Review and decide before the deadline."
  if ((item.businessValueScore ?? 0) > 0.8) return "Reply and qualify the opportunity."
  return "Save and monitor for follow-up."
}

export function planAutomationRule(input) {
  return {
    name: input.name,
    includeKeywords: input.includeKeywords ?? [],
    excludeKeywords: input.excludeKeywords ?? [],
    action: input.action ?? "save_and_digest",
    rationale: "Keep high-signal material while suppressing repeated low-value marketing content."
  }
}

