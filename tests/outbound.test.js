import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { BridgeStore } from "../src/store.js"
import { HttpGatewayOutbound, RecordOnlyOutbound, createOutbound, defaultIlkBody } from "../src/outbound.js"

async function makeStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "dwo-outbound-"))
  const store = new BridgeStore(path.join(dir, "state.json"))
  await store.load()
  return { store, dir }
}

test("defaultIlkBody matches the iLink /messages/send contract", () => {
  const body = defaultIlkBody({ toUserId: "alice", text: "hi", contextToken: "CTX-1" })
  assert.deepEqual(body, {
    to: "alice",
    context_token: "CTX-1",
    items: [{ type: "text", text: "hi" }]
  })
})

test("RecordOnlyOutbound records without transmitting", async () => {
  const { store, dir } = await makeStore()
  try {
    const outbound = new RecordOnlyOutbound(store)
    const action = await outbound.sendText({ toUserId: "alice", text: "hi", contextToken: "CTX-1" })
    assert.equal(action.mode, "record-only")
    assert.equal(action.delivered, false)
    assert.equal(store.listOutboundActions().length, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("HttpGatewayOutbound dispatches to the gateway and reports delivered", async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return { ok: true, status: 200 }
  }
  const outbound = new HttpGatewayOutbound({
    url: "http://127.0.0.1:3456/messages/send",
    apiKey: "gateway-key",
    fetchImpl
  })
  const action = await outbound.sendText({ toUserId: "alice", text: "hi", contextToken: "CTX-1" })
  assert.equal(action.mode, "ilink-gateway")
  assert.equal(action.delivered, true)
  assert.equal(action.gatewayStatus, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.headers.authorization, "Bearer gateway-key")
  assert.equal(JSON.parse(calls[0].options.body).to, "alice")
})

test("HttpGatewayOutbound marks non-2xx responses as undelivered", async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, text: async () => "bad token" })
  const outbound = new HttpGatewayOutbound({ url: "http://x/messages/send", fetchImpl })
  const action = await outbound.sendText({ toUserId: "alice", text: "hi", contextToken: "CTX-1" })
  assert.equal(action.delivered, false)
  assert.equal(action.gatewayStatus, 400)
  assert.equal(action.gatewayError, "bad token")
})

test("HttpGatewayOutbound rejects a reply with no context_token", async () => {
  const outbound = new HttpGatewayOutbound({ url: "http://x/messages/send" })
  await assert.rejects(
    () => outbound.sendText({ toUserId: "alice", text: "hi", contextToken: null }),
    /context_token/
  )
})

test("createOutbound defaults to record-only for unknown modes", () => {
  const store = {}
  assert.equal(createOutbound("record-only", { store }).mode, "record-only")
  assert.equal(createOutbound("typo-mode", { store }).mode, "record-only")
  assert.equal(createOutbound("ilink-gateway", { url: "http://x" }).mode, "ilink-gateway")
})

test("createOutbound requires a url for ilink-gateway", () => {
  assert.throws(() => createOutbound("ilink-gateway", {}), /url/)
})
