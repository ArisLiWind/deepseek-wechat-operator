// Social-profile analysis, computed entirely from local chat records YOU supply.
// Read-only: no WeChat transport, no reverse-engineering, no account risk.
//
// Two questions it answers:
//   1. Who do you talk to least / most, and who has gone quiet?
//   2. What does each person talk about (their interest profile)?
//
// Input is a plain JSON array of messages. Field names are tolerant:
//   { "from": "张三", "to": "我", "text": "…", "ts": 1786656895601 }
// Also accepts { messages: [...] } or { records: [...] } wrappers, and the
// common aliases sender/receiver/content/time/timestamp/create_time_ms.

const INTEREST_CATEGORIES = [
  ["投资理财", ["投资", "股票", "基金", "理财", "行情", "涨停", "加仓", "持仓", "牛市"]],
  ["AI/科技", ["人工智能", "大模型", "deepseek", "openai", "gpt", "编程", "代码", "算法", "开源"]],
  ["创业/工作", ["创业", "融资", "项目", "合作", "客户", "招聘", "岗位", "老板", "加班", "kpi"]],
  ["健身/运动", ["健身", "跑步", "撸铁", "瑜伽", "篮球", "游泳", "减肥", "马拉松"]],
  ["美食", ["火锅", "烧烤", "奶茶", "餐厅", "做饭", "外卖", "探店"]],
  ["旅行", ["旅行", "旅游", "机票", "酒店", "出国", "自驾", "攻略", "签证"]],
  ["游戏", ["游戏", "开黑", "王者", "原神", "steam", "上分", "吃鸡"]],
  ["育儿/家庭", ["孩子", "上学", "家长", "辅导", "幼儿园", "带娃", "婆媳"]],
  ["购物", ["淘宝", "京东", "拼多多", "下单", "优惠券", "双十一", "618"]],
  ["影视/娱乐", ["电影", "电视剧", "综艺", "追剧", "演唱会", "票房"]],
  ["健康/医疗", ["看病", "医院", "体检", "失眠", "养生", "中医"]],
  ["房产", ["买房", "房价", "楼盘", "房贷", "装修", "首付"]],
  ["汽车", ["买车", "特斯拉", "新能源", "保养", "驾照", "suv"]],
  ["教育/学习", ["考试", "课程", "英语", "考研", "读书", "培训", "考证"]],
  ["金融/币", ["比特币", "区块链", "炒币", "虚拟货币", "以太坊"]]
]

export function matchInterests(text) {
  const lower = String(text ?? "").toLowerCase()
  const hits = {}
  for (const [category, keywords] of INTEREST_CATEGORIES) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        hits[category] = (hits[category] ?? 0) + 1
      }
    }
  }
  return hits
}

export function normalizeRecords(input) {
  let records = input
  if (!Array.isArray(records)) {
    if (Array.isArray(records?.messages)) records = records.messages
    else if (Array.isArray(records?.records)) records = records.records
    else throw new Error("social data must be an array of messages (or {messages:[...]} / {records:[...]})")
  }

  return records
    .map(raw => {
      const from = raw.from ?? raw.sender ?? raw.senderName ?? raw.from_name ?? ""
      const to = raw.to ?? raw.receiver ?? raw.receiverName ?? raw.to_name ?? ""
      const text = String(raw.text ?? raw.content ?? raw.body ?? raw.message ?? "")
      const tsRaw = raw.ts ?? raw.time ?? raw.timestamp ?? raw.createTime ?? raw.create_time_ms ?? null
      const ts = tsRaw == null ? null : Number(tsRaw)
      return { from, to, text, ts: Number.isFinite(ts) ? ts : null }
    })
    .filter(r => r.text.trim().length > 0 && (r.from || r.to))
}

export function inferSelf(records) {
  const counts = new Map()
  for (const r of records) {
    for (const v of [r.from, r.to]) {
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }
  let best = null
  let bestCount = -1
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v
      bestCount = c
    }
  }
  return best ?? "我"
}

export function computeSocial(input, options = {}) {
  const records = normalizeRecords(input)
  const self = options.self ?? inferSelf(records)
  const now = options.now ?? Date.now()

  const perContact = new Map()
  for (const r of records) {
    const other = r.from === self ? r.to : r.from
    if (!other || other === self) continue

    let c = perContact.get(other)
    if (!c) {
      c = { name: other, sentByMe: 0, receivedFrom: 0, total: 0, lastAt: null, lastText: "", interestHits: {} }
      perContact.set(other, c)
    }

    if (r.from === self) c.sentByMe++
    else c.receivedFrom++
    c.total++

    if (r.ts != null && (c.lastAt == null || r.ts > c.lastAt)) {
      c.lastAt = r.ts
      c.lastText = r.text.slice(0, 60)
    }

    // Interests come from THEIR messages only.
    if (r.from !== self) {
      for (const [category, count] of Object.entries(matchInterests(r.text))) {
        c.interestHits[category] = (c.interestHits[category] ?? 0) + count
      }
    }
  }

  const contacts = [...perContact.values()].map(c => ({
    name: c.name,
    sentByMe: c.sentByMe,
    receivedFrom: c.receivedFrom,
    total: c.total,
    lastAt: c.lastAt,
    lastText: c.lastText,
    daysSinceLast: c.lastAt ? Math.max(0, Math.floor((now - c.lastAt) / 86400000)) : null,
    interests: Object.entries(c.interestHits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }))
  }))

  return {
    self,
    generatedAt: new Date(now).toISOString(),
    totalMessages: records.length,
    contactCount: contacts.length,
    contacts: contacts.sort((a, b) => b.total - a.total),
    mostInactive: contacts
      .filter(c => c.lastAt != null)
      .sort((a, b) => a.lastAt - b.lastAt)
      .slice(0, 20),
    now
  }
}
