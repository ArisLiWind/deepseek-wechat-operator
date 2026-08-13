import test from "node:test"
import assert from "node:assert/strict"
import { DesktopWechatController } from "../src/desktop.js"

// A Node-callback execFile stand-in. Resolves { stdout, stderr } like the real
// promisify(execFile), and can fail specific commands to exercise error paths.
function fakeExec(calls, { stdout = "", fail = () => false } = {}) {
  return (cmd, args, _opts, cb) => {
    calls.push({ cmd, args: [...args] })
    if (fail(cmd)) {
      const err = new Error(`${cmd} failed`)
      err.stderr = `${cmd} permission denied`
      cb(err)
    } else {
      cb(null, { stdout, stderr: "" })
    }
  }
}

const instant = () => Promise.resolve()

test("activate opens the WeChat app", async () => {
  const calls = []
  const ctrl = new DesktopWechatController({ execFile: fakeExec(calls), wechatApp: "WeChat" })
  const result = await ctrl.activate()
  assert.equal(result.ok, true)
  assert.deepEqual(calls[0], { cmd: "/usr/bin/open", args: ["-a", "WeChat"] })
})

test("send drives the full keyboard sequence", async () => {
  const calls = []
  const ctrl = new DesktopWechatController({
    execFile: fakeExec(calls),
    cliclickPath: "/fake/cliclick",
    sleep: instant
  })
  const result = await ctrl.send({ contact: "张三", text: "你好" })
  assert.equal(result.ok, true)
  assert.deepEqual(calls.map((c) => [c.cmd, c.args.join(" ")]), [
    ["/usr/bin/open", "-a WeChat"],
    ["/fake/cliclick", "kp:cmd+f"],
    ["/fake/cliclick", "t:张三"],
    ["/fake/cliclick", "kp:return"],
    ["/fake/cliclick", "t:你好"],
    ["/fake/cliclick", "kp:return"]
  ])
})

test("send requires contact and text", async () => {
  const ctrl = new DesktopWechatController({ execFile: fakeExec([]), sleep: instant })
  await assert.rejects(() => ctrl.send({ contact: "", text: "x" }), /contact and text are required/)
  await assert.rejects(() => ctrl.send({ contact: "x", text: "" }), /contact and text are required/)
})

test("status reports each capability with actionable hints", async () => {
  const calls = []
  const ctrl = new DesktopWechatController({
    execFile: fakeExec(calls, { fail: (cmd) => cmd.includes("cliclick") || cmd.includes("screencapture") }),
    cliclickPath: "/fake/cliclick",
    ocrPath: "/fake/ocr-missing",
    sleep: instant
  })
  const report = await ctrl.status()
  assert.ok("wechatApp" in report)
  assert.ok("cliclick" in report)
  assert.ok("screenshot" in report)
  assert.ok("ocr" in report)
  assert.match(report.cliclick, /辅助功能/)
  assert.match(report.screenshot, /屏幕录制/)
  assert.match(report.ocr, /build-ocr/)
})
