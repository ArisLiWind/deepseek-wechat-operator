#!/usr/bin/env node
// wechat:login — a local page that renders the iLink gateway's QR login and
// polls the login state, so the user only ever does one thing: scan the code.
//
// The QR image is generated SERVER-SIDE (no CDN dependency), and the page also
// shows a "copy link" fallback for opening the login URL directly in phone
// WeChat.
//
// Env:
//   GATEWAY_URL        default http://127.0.0.1:3456
//   GATEWAY_API_KEY    the gateway's API_KEY (required to reach /auth/login & /status)
//   LOGIN_PORT         default 3470

import http from "node:http"
import QRCode from "qrcode"

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://127.0.0.1:3456"
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY ?? ""
const PORT = Number(process.env.LOGIN_PORT ?? 3470)

async function gateway(pathname, { method = "GET" } = {}) {
  const headers = {}
  if (GATEWAY_API_KEY) headers.authorization = `Bearer ${GATEWAY_API_KEY}`
  const res = await fetch(new URL(pathname, GATEWAY_URL), { method, headers })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

async function toQrImage(text) {
  try {
    return await QRCode.toDataURL(text, { width: 260, margin: 2, errorCorrectionLevel: "M" })
  } catch {
    return null
  }
}

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(payload))
}

const PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>微信扫码登录 · DeepSeek WeChat Operator</title>
<style>
  body { font-family: -apple-system, "PingFang SC", sans-serif; max-width: 440px; margin: 40px auto; padding: 0 16px; color: #1f2328; }
  h1 { font-size: 20px; }
  .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; }
  #status { font-size: 14px; min-height: 22px; margin-bottom: 12px; }
  #qr { margin: 0 auto; display: block; border: 1px solid #eee; border-radius: 8px; }
  .muted { color: #6b7280; font-size: 12px; }
  .link { color: #2f81f7; word-break: break-all; font-size: 11px; }
  .error { color: #d1242f; }
  .ok { color: #1a7f37; }
  button { margin: 4px; padding: 8px 14px; border-radius: 8px; border: 1px solid #d0d7de; background: #f6f8fa; cursor: pointer; font-size: 14px; }
  button:hover { background: #eaeef2; }
  hr { border: none; border-top: 1px solid #eee; margin: 16px 0; }
</style>
</head>
<body>
  <h1>微信扫码登录</h1>
  <div class="card">
    <div id="status">正在获取二维码…</div>
    <img id="qr" alt="二维码" width="260" height="260" />
    <p class="muted">用微信「扫一扫」扫上面的码，手机上点「确认」。</p>
    <button id="refresh" type="button" onclick="refreshQr()">刷新二维码</button>
  </div>

  <div class="card" style="margin-top:12px">
    <p class="muted" style="margin-top:0">或者：复制下面的链接，发到手机微信里打开</p>
    <button type="button" onclick="copyLink()">复制链接</button>
    <p><a id="link" class="link" target="_blank" rel="noopener"></a></p>
  </div>
  <script>
    let timer = null
    let confirmed = false
    let currentUrl = null

    function setStatus(text, cls) {
      const el = document.getElementById("status")
      el.textContent = text
      el.className = cls || ""
    }

    async function copyLink() {
      if (!currentUrl) return
      try { await navigator.clipboard.writeText(currentUrl); setStatus("已复制链接", "ok") }
      catch { setStatus("复制失败，请手动长按链接复制", "error") }
    }

    async function refreshQr() {
      confirmed = false
      setStatus("正在获取二维码…")
      try {
        const r = await fetch("/api/qr").then(x => x.json())
        if (!r.qr_url) { setStatus("未拿到二维码：" + JSON.stringify(r), "error"); return }
        currentUrl = r.qr_url
        document.getElementById("link").href = r.qr_url
        document.getElementById("link").textContent = r.qr_url
        const img = document.getElementById("qr")
        if (r.qr_image) {
          img.src = r.qr_image
          img.style.display = "block"
        } else {
          img.style.display = "none"
        }
        setStatus("等待扫码…")
        startPolling()
      } catch (err) {
        setStatus("获取二维码失败：" + err.message, "error")
      }
    }

    function startPolling() {
      if (timer) clearInterval(timer)
      timer = setInterval(poll, 2000)
    }

    async function poll() {
      if (confirmed) return
      try {
        const s = await fetch("/api/status").then(x => x.json())
        const st = s.login_status ?? "unknown"
        if (s.logged_in === true || st === "confirmed") {
          confirmed = true
          clearInterval(timer)
          setStatus("✅ 已登录，机器人身份已授权", "ok")
        } else if (st === "scanned") {
          setStatus("📱 已扫码，请在手机上确认…")
        } else if (st === "failed") {
          setStatus("❌ 二维码过期，自动刷新中…", "error")
          clearInterval(timer)
          setTimeout(refreshQr, 1200)
        } else {
          setStatus("等待扫码…")
        }
      } catch (err) {
        setStatus("无法连接网关：" + err.message, "error")
      }
    }

    refreshQr()
  </script>
</body>
</html>
`

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1")
  try {
    if (url.pathname === "/api/qr") {
      const { status, body } = await gateway("/auth/login", { method: "POST" })
      if (body.qr_url) {
        body.qr_image = await toQrImage(body.qr_url)
      }
      return json(res, status === 200 ? 200 : 502, body)
    }
    if (url.pathname === "/api/status") {
      const { status, body } = await gateway("/status")
      return json(res, status === 200 ? 200 : 502, body)
    }
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      return res.end(PAGE)
    }
    return json(res, 404, { ok: false, error: "not found" })
  } catch (error) {
    return json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(`wechat:login page  →  http://127.0.0.1:${PORT}`)
  console.log(`iLink gateway      →  ${GATEWAY_URL}`)
})
