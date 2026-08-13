import { performance } from "node:perf_hooks"
import { buildDailyDigest, searchItems } from "./domain.js"
import { getDemoFixtures } from "./fixtures.js"

function makeDataset(size) {
  const base = getDemoFixtures()
  const items = []
  for (let i = 0; i < size; i++) {
    const seed = base[i % base.length]
    items.push({
      ...seed,
      id: `${seed.id}-${i}`,
      publishedAt: `2026-08-13T${String(i % 24).padStart(2, "0")}:00:00+08:00`,
      body: `${seed.body} [copy ${i}]`,
      title: `${seed.title ?? seed.sender ?? "Item"} ${i}`
    })
  }
  return items
}

const dataset = makeDataset(10000)

const t1 = performance.now()
const digest = buildDailyDigest(dataset, { limit: 10 })
const t2 = performance.now()
const search = searchItems(dataset, "agent", {}).slice(0, 10)
const t3 = performance.now()

console.log(JSON.stringify({
  datasetSize: dataset.length,
  digestMs: Number((t2 - t1).toFixed(2)),
  searchMs: Number((t3 - t2).toFixed(2)),
  topDigestId: digest[0]?.id ?? null,
  topSearchId: search[0]?.id ?? null
}, null, 2))
