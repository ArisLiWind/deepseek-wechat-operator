import { buildDailyDigest, extractOpportunities, rankReplyCandidates } from "./domain.js"
import { getDemoFixtures } from "./fixtures.js"

const items = getDemoFixtures()

const output = {
  digest: buildDailyDigest(items, { limit: 5 }),
  replyRanking: rankReplyCandidates(items, { limit: 3 }),
  opportunities: extractOpportunities(items)
}

console.log(JSON.stringify(output, null, 2))

