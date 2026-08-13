import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { collectDoctorReport, renderDoctorReport } from "../src/doctor.js"

function makeExec(available = {}) {
  return command => {
    if (command in available) return available[command]
    const error = new Error(`${command}: command not found`)
    error.code = 127
    throw error
  }
}

function okFetch(status = 200) {
  return async () => ({ ok: status >= 200 && status < 400, status })
}

function downFetch() {
  return async () => {
    throw new Error("connect ECONNREFUSED")
  }
}

test("report marks a fully-wired profile as ready", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "dwo-doctor-"))
  try {
    await mkdir(path.join(tmp, "profiles", "web", "node_modules", "dsh-plugin-deepseek-wechat-operator"), { recursive: true })
    await writeFile(
      path.join(tmp, "profiles", "web", "cordis.patch.yml"),
      "- insert:\n    - id: deepseek-wechat-operator\n      name: dsh-plugin-deepseek-wechat-operator\n      config:\n        mode: mock\n"
    )

    const report = await collectDoctorReport({
      env: { DSH_HOME: tmp, HOME: tmp },
      nodeVersion: "22.5.0",
      exec: makeExec({ "dsh --version": "1.2.3" }),
      fetchImpl: okFetch()
    })

    assert.equal(report.summary.ready, true)
    assert.equal(report.profile.patched, true)
    assert.equal(report.profile.mode, "mock")
    assert.equal(report.profile.pluginResolvable, true)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test("report lists next actions for an unwired environment", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "dwo-doctor-"))
  try {
    const report = await collectDoctorReport({
      env: { DSH_HOME: tmp, HOME: tmp },
      nodeVersion: "20.0.0",
      exec: makeExec({}),
      fetchImpl: downFetch()
    })

    assert.equal(report.summary.ready, false)
    assert.ok(report.summary.nextActions.length > 0)
    assert.equal(report.profile.patched, false)
    const failedIds = report.checks.filter(c => c.level === "fail").map(c => c.id)
    assert.ok(failedIds.includes("node"))
    assert.ok(failedIds.includes("patch"))
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test("detects bridge mode from the patch", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "dwo-doctor-"))
  try {
    await mkdir(path.join(tmp, "profiles", "web"), { recursive: true })
    await writeFile(
      path.join(tmp, "profiles", "web", "cordis.patch.yml"),
      "mode: bridge\n- insert:\n    - id: deepseek-wechat-operator\n"
    )

    const report = await collectDoctorReport({
      env: { DSH_HOME: tmp, HOME: tmp },
      exec: makeExec({}),
      fetchImpl: downFetch()
    })
    assert.equal(report.profile.mode, "bridge")
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test("render produces a readable report", async () => {
  const report = await collectDoctorReport({
    env: { DSH_HOME: "/nonexistent", HOME: "/nonexistent" },
    exec: makeExec({}),
    fetchImpl: downFetch()
  })
  const text = renderDoctorReport(report)
  assert.match(text, /doctor/)
  assert.match(text, /Node\.js/)
})
