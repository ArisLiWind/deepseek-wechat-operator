// doctor — a self-check that reports exactly what is wired and what is missing,
// in dependency order. It never mutates anything; it only reads and probes.
//
//   npm run doctor
//
// Exit code: 0 when every hard check passes, 1 otherwise. (bridge/gateway are
// "warn" level because they are only required for bridge mode / real sending.)

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { execFileSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function parseNodeVersion(version) {
  const match = String(version).match(/^v?(\d+)\.(\d+)/)
  if (!match) return { major: 0, minor: 0 }
  return { major: Number(match[1]), minor: Number(match[2]) }
}

function nodeIsSupported(version) {
  return parseNodeVersion(version).major >= 22
}

function tryExec(exec, command) {
  try {
    return { ok: true, output: String(exec(command)).trim() }
  } catch {
    return { ok: false, output: "" }
  }
}

async function probeHttp(fetchImpl, url, { timeoutMs = 1500 } = {}) {
  if (!fetchImpl) return { reachable: false, error: "no fetch" }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, { signal: controller.signal })
    const status = typeof response?.status === "number" ? response.status : null
    // Any HTTP response means the server is listening (401 is still "up").
    return { reachable: status !== null, status }
  } catch (error) {
    return {
      reachable: false,
      error: error?.name === "AbortError" ? "timeout" : String(error?.message ?? error)
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function collectDoctorReport(options = {}) {
  const env = options.env ?? process.env
  const exec = options.exec ?? (command =>
    execFileSync(command, { shell: true, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const repoRoot = options.repoRoot ?? REPO_ROOT

  const nodeVersion = options.nodeVersion ?? process.version
  const home = env.DSH_HOME ?? path.join(env.HOME ?? os.homedir(), ".dsh")
  const profileDir = path.join(home, "profiles", "web")
  const patchFile = path.join(profileDir, "cordis.patch.yml")

  const bridgeUrl = options.bridgeUrl ?? env.WECHAT_OPERATOR_BRIDGE_URL ?? "http://127.0.0.1:3468"
  const gatewayUrl = options.gatewayUrl ?? env.ILINK_GATEWAY_URL ?? "http://127.0.0.1:3456"

  const nodeOk = nodeIsSupported(nodeVersion)
  const repoDepsInstalled = existsSync(path.join(repoRoot, "node_modules", "@deepseek-ai", "dsh-tools"))

  const dshProbe = tryExec(exec, "dsh --version")

  const profileExists = existsSync(profileDir)
  const patchExists = existsSync(patchFile)
  let patchText = ""
  if (patchExists) {
    try {
      patchText = readFileSync(patchFile, "utf8")
    } catch {
      patchText = ""
    }
  }
  const patched = patchText.includes("deepseek-wechat-operator")
  const patchMode = patched ? (patchText.includes("mode: bridge") ? "bridge" : "mock") : null

  const pluginResolvable = existsSync(path.join(profileDir, "node_modules", "dsh-plugin-deepseek-wechat-operator"))

  const bridge = await probeHttp(fetchImpl, new URL("/health", bridgeUrl).toString())
  const gateway = await probeHttp(fetchImpl, new URL("/console", gatewayUrl).toString())

  const checks = [
    { id: "node", label: "Node.js >= 22", level: nodeOk ? "pass" : "fail", detail: nodeVersion, hint: "Install Node 22+ (the plugin requires it)." },
    { id: "repo", label: "Repo dependencies installed", level: repoDepsInstalled ? "pass" : "fail", detail: repoRoot, hint: "Run `npm install` in the repo, then `npm test`." },
    { id: "dsh", label: "dsh CLI on PATH", level: dshProbe.ok ? "pass" : "warn", detail: dshProbe.ok ? dshProbe.output : "not found", hint: "No dsh CLI — use integration/install-into-dsh.sh or the manual pnpm path." },
    { id: "profile", label: "dsh profile \"web\" exists", level: profileExists ? "pass" : "fail", detail: profileDir, hint: `Run dsh once to create it, or mkdir -p "${profileDir}".` },
    { id: "patch", label: "Plugin listed in cordis.patch.yml", level: patched ? "pass" : "fail", detail: patchFile, hint: "Write the `- insert:` block (see examples/cordis.patch.yml) or run integration/install-into-dsh.sh." },
    { id: "resolve", label: "Plugin resolvable from profile", level: pluginResolvable ? "pass" : "fail", detail: path.join(profileDir, "node_modules", "dsh-plugin-deepseek-wechat-operator"), hint: `Run \`cd "${profileDir}" && pnpm add "file:${repoRoot}"\`.` },
    { id: "bridge", label: "Bridge reachable (mode: bridge)", level: bridge.reachable ? "pass" : "warn", detail: `${bridgeUrl}${bridge.status != null ? ` (${bridge.status})` : ""}`, hint: "Start it: `npm run bridge:dev`. Only needed for bridge mode." },
    { id: "gateway", label: "iLink gateway reachable (real send)", level: gateway.reachable ? "pass" : "warn", detail: `${gatewayUrl}${gateway.status != null ? ` (${gateway.status})` : ""}`, hint: "Only needed to actually transmit replies; see docs/use-with-ilink-gateway.md." }
  ]

  const failed = checks.filter(c => c.level === "fail")
  const nextActions = checks.filter(c => c.level !== "pass").map(c => `[${c.id}] ${c.hint}`)

  return {
    node: { ok: nodeOk, version: nodeVersion },
    repo: { ok: repoDepsInstalled, root: repoRoot },
    dsh: dshProbe,
    profile: { home, dir: profileDir, exists: profileExists, patchFile, patched, mode: patchMode, pluginResolvable },
    bridge: { url: bridgeUrl, ...bridge },
    gateway: { url: gatewayUrl, ...gateway },
    checks,
    summary: { ready: failed.length === 0, failedCount: failed.length, nextActions }
  }
}

export function renderDoctorReport(report) {
  const glyph = { pass: "✓", warn: "⚠", fail: "✗" }
  const lines = ["deepseek-wechat-operator — doctor", ""]
  for (const check of report.checks) {
    lines.push(` ${glyph[check.level]} ${check.label}`)
    lines.push(`     ${check.detail}`)
  }
  lines.push("")
  if (report.summary.ready) {
    lines.push("All hard checks pass. (bridge/gateway warnings only matter for bridge mode / real sending.)")
  } else {
    lines.push(`${report.summary.failedCount} hard check(s) failed. Next actions, in order:`)
    for (const action of report.summary.nextActions) lines.push(`  • ${action}`)
  }
  return lines.join("\n")
}

async function main() {
  const report = await collectDoctorReport()
  process.stdout.write(`${renderDoctorReport(report)}\n`)
  process.exitCode = report.summary.ready ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`doctor failed: ${error?.stack ?? error}\n`)
    process.exitCode = 1
  })
}
