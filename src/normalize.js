const ARTICLE_HINTS = [
  "http://",
  "https://",
  "公众号",
  "article"
]

const OPPORTUNITY_HINTS = [
  "融资",
  "合作",
  "岗位",
  "比赛",
  "fundraising",
  "partnership",
  "job",
  "competition",
  "demo day"
]

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item"
}

// iLink bot messages carry only `from_user_id` (an opaque openid) — no display
// name. Prefer a provided name; otherwise emit a friendly, still-distinguishable
// label instead of leaking the raw openid into digests and drafts.
function friendlySender(name, id) {
  const display = String(name ?? "").trim()
  if (display) return display
  const uid = String(id ?? "").trim()
  if (!uid) return "Unknown"
  if (uid.includes("@") || uid.length > 24 || /^[a-z0-9_-]{20,}$/i.test(uid)) {
    return `微信联系人(${uid.slice(0, 6)}…)`
  }
  return uid
}

function inferTopics(text) {
  const source = String(text ?? "").toLowerCase()
  const topics = []
  if (source.includes("agent")) topics.push("ai agent")
  if (source.includes("支付") || source.includes("payment")) topics.push("agent payments")
  if (source.includes("创业") || source.includes("startup")) topics.push("startup")
  if (source.includes("融资") || source.includes("fundraising")) topics.push("fundraising")
  if (source.includes("社交") || source.includes("social")) topics.push("ai social")
  if (source.includes("深圳") || source.includes("shenzhen")) topics.push("shenzhen")
  return [...new Set(topics)]
}

function inferTypeFromText(text) {
  if (ARTICLE_HINTS.some(hint => text.includes(hint))) return "article"
  if (OPPORTUNITY_HINTS.some(hint => text.toLowerCase().includes(hint.toLowerCase()))) return "opportunity"
  return "message"
}

function scoreFromText(text) {
  const topics = inferTopics(text)
  return {
    qualityScore: topics.length > 0 ? 0.74 : 0.58,
    noveltyScore: topics.length > 1 ? 0.72 : 0.55,
    businessValueScore: topics.some(topic => topic === "ai agent" || topic === "fundraising") ? 0.85 : 0.5,
    relationshipScore: 0.62,
    urgencyScore: text.includes("deadline") || text.includes("尽快") ? 0.78 : 0.42,
    topics
  }
}

function normalizeTextItem(message, item, index) {
  const text = item.text ?? item.text_item?.text ?? item.content ?? ""
  const inferred = scoreFromText(text)
  return {
    id: `${message.messageId}-text-${index}`,
    type: inferTypeFromText(text),
    sender: message.sender,
    contactId: message.senderId,
    title: text.slice(0, 80) || `${message.sender} message`,
    publishedAt: message.publishedAt,
    body: text,
    accessibleVia: "ilink_webhook",
    contextToken: message.contextToken,
    source: message.channel,
    why: "Captured from a real incoming WeChat-compatible event.",
    ...inferred
  }
}

function normalizeFileItem(message, item, index) {
  const fileName = item.file_name ?? item.name ?? `file-${index}`
  const text = `${fileName} ${item.caption ?? ""}`.trim()
  const inferred = scoreFromText(text)
  return {
    id: `${message.messageId}-file-${index}`,
    type: "file",
    sender: message.sender,
    contactId: message.senderId,
    title: fileName,
    fileName,
    publishedAt: message.publishedAt,
    body: item.caption ?? "Incoming file",
    accessibleVia: "ilink_webhook",
    contextToken: message.contextToken,
    source: message.channel,
    why: "Attachment surfaced through the event bridge.",
    ...inferred
  }
}

function normalizeMediaItem(message, item, index) {
  const kind = item.type === "image" ? "image" : item.type === "voice" ? "voice" : item.type === "video" ? "video" : "file"
  const fileName = item.file_name ?? item.file_item?.file_name ?? `${kind}-${index}`
  const caption = item.caption ?? item.voice_item?.text ?? item.text ?? ""
  const inferred = scoreFromText(`${kind} ${fileName} ${caption}`)
  return {
    id: `${message.messageId}-${kind}-${index}`,
    type: "file",
    mediaType: kind,
    sender: message.sender,
    contactId: message.senderId,
    title: fileName,
    fileName,
    publishedAt: message.publishedAt,
    body: caption || `${kind} attachment`,
    accessibleVia: "ilink_webhook",
    contextToken: message.contextToken,
    source: message.channel,
    why: "Attachment surfaced through the event bridge.",
    ...inferred
  }
}

function normalizeItems(message) {
  const items = Array.isArray(message.items) ? message.items : []
  return items.flatMap((item, index) => {
    if (item.type === "text" || item.type === 1 || item.text_item || item.text) {
      return [normalizeTextItem(message, item, index)]
    }
    if (item.type === "file" || item.type === 4 || item.file_name || item.file_item) {
      return [normalizeFileItem(message, item, index)]
    }
    if (item.type === "image" || item.type === 2 || item.image_item
      || item.type === "voice" || item.type === 3 || item.voice_item
      || item.type === "video" || item.type === 5 || item.video_item) {
      return [normalizeMediaItem(message, item, index)]
    }
    return []
  })
}

function toMessageEnvelope(payload) {
  if (payload?.messageId && Array.isArray(payload.items)) {
    return {
      messageId: payload.messageId,
      sender: payload.sender ?? payload.from ?? "Unknown",
      senderId: payload.senderId ?? payload.from_user_id ?? slugify(payload.sender ?? payload.from),
      publishedAt: payload.publishedAt ?? new Date().toISOString(),
      contextToken: payload.contextToken ?? payload.context_token ?? null,
      channel: payload.channel ?? "normalized",
      items: payload.items
    }
  }

  if (payload?.msg?.item_list) {
    return {
      messageId: payload.msg.client_id ?? payload.msg.msg_id ?? `ilink-${Date.now()}`,
      sender: friendlySender(payload.sender ?? payload.msg.from_nickname ?? payload.msg.from_user_name, payload.msg.from_user_id),
      senderId: payload.msg.from_user_id ?? slugify(payload.msg.from_user_name ?? payload.msg.from_nickname),
      publishedAt: payload.publishedAt ?? payload.msg.create_time ?? new Date().toISOString(),
      contextToken: payload.msg.context_token ?? null,
      channel: "ilink",
      items: payload.msg.item_list.map(item => {
        if (item.type === 1) return { type: "text", text: item.text_item?.text ?? "" }
        if (item.type === 3 || item.type === 4 || item.file_item) {
          return { type: "file", file_name: item.file_item?.file_name ?? item.file_name ?? "attachment" }
        }
        return item
      })
    }
  }

  if (payload?.items && Array.isArray(payload.items)) {
    return {
      messageId: payload.id ?? `gateway-${Date.now()}`,
      sender: payload.from_name ?? payload.from ?? "Unknown",
      senderId: payload.from ?? slugify(payload.from_name),
      publishedAt: payload.timestamp ?? new Date().toISOString(),
      contextToken: payload.context_token ?? null,
      channel: payload.channel ?? "gateway",
      items: payload.items
    }
  }

  // Raw WeixinMessage as emitted by weixin-ilink-gateway (and the iLink Bot
  // protocol itself): `item_list` at the top level with numeric item types
  // (1=text, 2=image, 3=voice, 4=file, 5=video).
  if (Array.isArray(payload?.item_list)) {
    return {
      messageId: payload.message_id ?? payload.messageId ?? `ilink-${Date.now()}`,
      sender: friendlySender(payload.from_user_name ?? payload.from_nickname, payload.from_user_id),
      senderId: payload.from_user_id ?? slugify(payload.from_user_name ?? payload.from_nickname),
      publishedAt: payload.create_time_ms
        ? new Date(Number(payload.create_time_ms)).toISOString()
        : new Date().toISOString(),
      contextToken: payload.context_token ?? null,
      channel: "ilink",
      items: payload.item_list.map(item => {
        if (item.type === 1) return { type: "text", text: item.text_item?.text ?? "" }
        if (item.type === 2) return { type: "image", image_item: item.image_item ?? null }
        if (item.type === 3) return { type: "voice", voice_item: item.voice_item ?? null }
        if (item.type === 4) return { type: "file", file_name: item.file_item?.file_name ?? item.file_name ?? "attachment", file_item: item.file_item ?? null }
        if (item.type === 5) return { type: "video", video_item: item.video_item ?? null }
        return item
      })
    }
  }

  throw new Error("Unsupported bridge payload shape")
}

export function normalizeInboundPayload(payload) {
  const envelope = toMessageEnvelope(payload)
  const accessibleItems = normalizeItems(envelope)

  return {
    message: envelope,
    accessibleItems
  }
}
