#!/usr/bin/env node
// Social-profile dashboard: reads local chat records and renders a self-contained
// visualization (no CDN, no external deps). Two questions: who has gone quiet,
// and what each person talks about.
//
//   npm run social                         # demo data, serves http://127.0.0.1:3480
//   SOCIAL_DATA=./records.json npm run social
//   SOCIAL_OUT=./report.html npm run social  # write a static HTML file instead

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import http from "node:http"
import { computeSocial } from "./social.js"
import { getDemoSocialRecords } from "./social-fixtures.js"

const PORT = Number(process.env.SOCIAL_PORT ?? 3480)
const OUT = process.env.SOCIAL_OUT ?? ""

function loadRecords() {
  const path = process.env.SOCIAL_DATA ?? process.argv[2] ?? ""
  if (!path) return getDemoSocialRecords()
  if (!existsSync(path)) throw new Error(`social data file not found: ${path}`)
  return JSON.parse(readFileSync(path, "utf8"))
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function fmtDate(ts) {
  if (ts == null) return "—"
  return new Date(ts).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
}

function barRow({ label, value, max, suffix = "", hint = "" }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return `<div class="bar-row">
    <div class="bar-label">${escapeHtml(label)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
    <div class="bar-value">${value}${suffix}</div>
    ${hint ? `<div class="bar-hint">${escapeHtml(hint)}</div>` : ""}
  </div>`
}

function interestTags(interests) {
  if (!interests.length) return '<span class="tag-empty">（无显著话题）</span>'
  return interests.map(i => `<span class="tag">${escapeHtml(i.tag)} <em>${i.count}</em></span>`).join("")
}

function render(report) {
  const maxTotal = Math.max(1, ...report.contacts.map(c => c.total))
  const top = report.contacts.slice(0, 12)
  const quiet = report.mostInactive.slice(0, 12)

  const topRows = top.map(c => barRow({
    label: c.name,
    value: c.total,
    max: maxTotal,
    suffix: " 条",
    hint: `${c.sentByMe} 发 / ${c.receivedFrom} 收`
  })).join("")

  const quietRows = quiet.map(c => `
    <div class="quiet-row">
      <div class="quiet-name">${escapeHtml(c.name)}</div>
      <div class="quiet-days">${c.daysSinceLast} 天没联系</div>
      <div class="quiet-last">最后：${fmtDate(c.lastAt)} · “${escapeHtml(c.lastText)}”</div>
    </div>`).join("")

  const interestCards = report.contacts
    .filter(c => c.interests.length > 0)
    .map(c => `
      <div class="card">
        <div class="card-name">${escapeHtml(c.name)}</div>
        <div class="card-tags">${interestTags(c.interests)}</div>
      </div>`).join("")

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>微信社交画像 · DeepSeek WeChat Operator</title>
<style>
  body { font-family: -apple-system, "PingFang SC", sans-serif; max-width: 760px; margin: 32px auto; padding: 0 16px; color: #1f2328; }
  h1 { font-size: 22px; }
  .sub { color: #6b7280; font-size: 13px; margin: 4px 0 24px; }
  .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
  .stat { flex: 1; min-width: 120px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }
  .stat b { font-size: 22px; display: block; }
  .stat span { color: #6b7280; font-size: 12px; }
  h2 { font-size: 16px; margin: 28px 0 12px; border-left: 3px solid #2f81f7; padding-left: 8px; }
  .bar-row { display: grid; grid-template-columns: 90px 1fr 60px; gap: 8px; align-items: center; margin-bottom: 8px; }
  .bar-label { font-size: 13px; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar-track { background: #eef1f4; border-radius: 6px; height: 16px; }
  .bar-fill { background: linear-gradient(90deg, #2f81f7, #5ba0ff); border-radius: 6px; height: 100%; }
  .bar-value { font-size: 12px; color: #1f2328; }
  .bar-hint { grid-column: 2 / 4; font-size: 11px; color: #9aa1a9; margin-top: -4px; }
  .quiet-row { border-bottom: 1px solid #f0f0f0; padding: 8px 0; }
  .quiet-name { font-size: 14px; font-weight: 600; }
  .quiet-days { display: inline-block; margin-left: 8px; font-size: 12px; color: #d1242f; }
  .quiet-last { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; }
  .card-name { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
  .tag { display: inline-block; background: #eef4ff; color: #2f5fd0; border-radius: 12px; padding: 2px 10px; margin: 2px 4px 2px 0; font-size: 12px; }
  .tag em { font-style: normal; color: #8aa0cc; }
  .tag-empty { color: #9aa1a9; font-size: 12px; }
  .note { margin-top: 28px; padding: 12px; background: #fff8e6; border-radius: 8px; font-size: 12px; color: #7a5c00; }
</style>
</head>
<body>
  <h1>微信社交画像</h1>
  <div class="sub">基于本地聊天记录 · 本人「${escapeHtml(report.self)}」· 生成于 ${fmtDate(report.now)}</div>

  <div class="stats">
    <div class="stat"><b>${report.totalMessages}</b><span>消息总数</span></div>
    <div class="stat"><b>${report.contactCount}</b><span>联系人</span></div>
  </div>

  <h2>联系最多的人</h2>
  ${topRows || '<div class="tag-empty">暂无数据</div>'}

  <h2>最久没联系的人（谁不常跟你聊天）</h2>
  ${quietRows || '<div class="tag-empty">暂无数据</div>'}

  <h2>每个人的兴趣画像</h2>
  <div class="cards">${interestCards || '<div class="tag-empty">暂无数据</div>'}</div>

  <div class="note">数据完全来自你本地的聊天记录导出，本工具只读不传、不碰微信协议、不封号。想用真实数据：把聊天记录整理成 JSON 数组（{from,to,text,ts}），跑 <code>SOCIAL_DATA=./records.json npm run social</code>。</div>
</body>
</html>`
}

const report = computeSocial(loadRecords())

if (OUT) {
  writeFileSync(OUT, render(report), "utf8")
  console.log(`wrote ${OUT} (${report.contactCount} contacts, ${report.totalMessages} messages)`)
} else {
  const server = http.createServer((req, res) => {
    if (req.url === "/api/report") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" })
      return res.end(JSON.stringify(report, null, 2))
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    res.end(render(report))
  })
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`social dashboard → http://127.0.0.1:${PORT}`)
  })
}
