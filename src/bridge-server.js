#!/usr/bin/env node

import http from "node:http"
import path from "node:path"
import { normalizeInboundPayload } from "./normalize.js"
import { BridgeStore } from "./store.js"

const PORT = Number(process.env.PORT ?? 3468)
const HOST = process.env.HOST ?? "127.0.0.1"
const API_KEY = process.env.WECHAT_OPERATOR_API_KEY ?? ""
const STORAGE_PATH = path.resolve(process.cwd(), process.env.WECHAT_OPERATOR_STORAGE_PATH ?? ".deepseek-wechat-operator/bridge-state.json")

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", chunk => chunks.push(chunk))
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8")
        resolve(raw.length === 0 ? {} : JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
  })
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  })
  res.end(`${JSON.stringify(payload, null, 2)}\n`)
}

function isAuthorized(req) {
  if (!API_KEY) return true
  return req.headers.authorization === `Bearer ${API_KEY}`
}

const store = new BridgeStore(STORAGE_PATH)
await store.load()

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true, service: "deepseek-wechat-operator-bridge" })
    }

    if (!isAuthorized(req)) {
      return sendJson(res, 401, { ok: false, error: "Unauthorized" })
    }

    if (req.method === "GET" && url.pathname === "/items") {
      return sendJson(res, 200, { ok: true, items: store.listItems() })
    }

    if (req.method === "GET" && url.pathname === "/outbound-actions") {
      return sendJson(res, 200, { ok: true, actions: store.listOutboundActions() })
    }

    if (req.method === "POST" && (url.pathname === "/ingest/ilink" || url.pathname === "/ingest/normalized")) {
      const body = await readJsonBody(req)
      const normalized = normalizeInboundPayload(body)
      const stored = await store.appendNormalized(normalized)
      return sendJson(res, 200, {
        ok: true,
        stored,
        senderId: normalized.message.senderId,
        contextTokenCached: Boolean(normalized.message.contextToken)
      })
    }

    if (req.method === "POST" && url.pathname === "/actions/send-text") {
      const body = await readJsonBody(req)
      const toUserId = body.toUserId
      const text = body.text
      const contextToken = store.getContextToken(toUserId)

      if (!toUserId || !text) {
        return sendJson(res, 400, { ok: false, error: "toUserId and text are required" })
      }

      if (!contextToken) {
        return sendJson(res, 409, { ok: false, error: `No cached context_token for ${toUserId}` })
      }

      const action = {
        id: `outbound-${Date.now()}`,
        type: "send_message",
        toUserId,
        text,
        contextToken,
        mode: "record-only",
        createdAt: new Date().toISOString()
      }
      await store.recordOutboundAction(action)
      return sendJson(res, 200, { ok: true, action })
    }

    return sendJson(res, 404, { ok: false, error: "Not found" })
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`DeepSeek WeChat Operator bridge listening on http://${HOST}:${PORT}`)
  if (API_KEY) {
    console.log("Auth enabled with Bearer token")
  } else {
    console.log("Auth disabled for local development")
  }
})
