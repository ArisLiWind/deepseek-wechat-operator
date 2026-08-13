/**
 * Desktop UI-automation controller — the "抓手腕" for your real WeChat.
 *
 * This is the OTHER transport, orthogonal to the iLink/ClawBot bridge: instead
 * of talking to Tencent's bot protocol, it drives the WeChat desktop app that is
 * already installed and logged in on this machine, through macOS Accessibility
 * (mouse/keyboard via cliclick), Screen Recording (screencapture), and the
 * built-in Vision framework (OCR, compiled from src/ocr.swift).
 *
 * It operates on YOUR real account — your chats, your groups — not a separate
 * bot identity. It is honest about its prerequisites and never pretends to have
 * done something it could not.
 *
 * Prerequisites (checked by `status()`):
 *   - macOS + /Applications/WeChat.app installed and logged in
 *   - cliclick (`brew install cliclick`)
 *   - Accessibility permission for the host terminal
 *   - Screen Recording permission for the host terminal
 *   - src/ocr built via `scripts/build-ocr.sh`
 *
 * `execFile` is injectable so tests can run without a real desktop.
 */

import { execFile as execFileCb } from "node:child_process"
import { promisify } from "node:util"
import { existsSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_CLICLICK = "/opt/homebrew/bin/cliclick"
const DEFAULT_OCR = path.join(MODULE_DIR, "ocr")

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export class DesktopWechatController {
  constructor(options = {}) {
    this.cliclickPath = options.cliclickPath ?? DEFAULT_CLICLICK
    this.ocrPath = options.ocrPath ?? DEFAULT_OCR
    this.wechatApp = options.wechatApp ?? "WeChat"
    this.screenshotPath = options.screenshotPath ?? path.join(os.tmpdir(), "wechat-operator-desktop.png")
    this.sendKey = options.sendKey ?? "kp:return"
    this.execFile = options.execFile ?? execFileCb
    this.sleep = options.sleep ?? sleep
    this.run = promisify(this.execFile)
  }

  async sh(cmd, args = []) {
    try {
      const { stdout } = await this.run(cmd, args, { timeout: 20000 })
      return String(stdout ?? "")
    } catch (error) {
      const detail = String(error?.stderr ?? error?.message ?? error).trim()
      throw new Error(`${cmd} ${args.join(" ")} 失败: ${detail}`)
    }
  }

  /** Bring WeChat to the front. */
  async activate() {
    await this.sh("/usr/bin/open", ["-a", this.wechatApp])
    return { ok: true, wechatApp: this.wechatApp }
  }

  /**
   * Type a message into WeChat and send it to a contact.
   * Keyboard-only flow: Cmd+F search → Enter opens first match → type → Enter sends.
   */
  async send({ contact, text }) {
    if (!contact || !text) throw new Error("contact and text are required")
    await this.activate()
    await this.sleep(600)
    await this.sh(this.cliclickPath, ["kp:cmd+f"])
    await this.sleep(400)
    await this.sh(this.cliclickPath, ["t:" + contact])
    await this.sleep(600)
    await this.sh(this.cliclickPath, ["kp:return"])
    await this.sleep(500)
    await this.sh(this.cliclickPath, ["t:" + text])
    await this.sleep(300)
    await this.sh(this.cliclickPath, [this.sendKey])
    return { ok: true, contact, text }
  }

  /** Screenshot the current screen and OCR it (best effort — returns raw text). */
  async read() {
    await this.activate()
    await this.sleep(500)
    await this.sh("/usr/sbin/screencapture", ["-x", this.screenshotPath])
    const text = await this.sh(this.ocrPath, [this.screenshotPath])
    return { ok: true, text }
  }

  /** Environment self-check. Never throws; each field reports ok or a hint. */
  async status() {
    const report = {}
    report.wechatApp = existsSync(`/Applications/${this.wechatApp}.app`)
      ? "ok"
      : `未找到 /Applications/${this.wechatApp}.app`

    try {
      await this.sh(this.cliclickPath, ["p"])
      report.cliclick = "ok"
    } catch (error) {
      report.cliclick = `需要「辅助功能」权限：${error.message}`
    }

    try {
      await this.sh("/usr/sbin/screencapture", ["-x", path.join(os.tmpdir(), "wechat-operator-check.png")])
      report.screenshot = "ok"
    } catch {
      report.screenshot = "需要「屏幕录制」权限"
    }

    report.ocr = existsSync(this.ocrPath)
      ? "ok"
      : "未编译，先跑 scripts/build-ocr.sh"
    return report
  }
}
