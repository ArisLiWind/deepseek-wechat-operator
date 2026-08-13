const today = [
  {
    type: "Investor",
    title: "Zoe Capital follow-up on your agent infra deck",
    meta: "Message · 16:05",
    body: "Why it matters: highest-stakes thread today. They want moat, GTM, and your WeChat-layer thesis."
  },
  {
    type: "Article",
    title: "Why Agent Payments Will Rewire Consumer Software",
    meta: "Public link · 08:00",
    body: "Why it matters: strong strategic signal for monetizing agent workflows and approvals."
  },
  {
    type: "File",
    title: "2026 China Agent Landscape.pdf",
    meta: "Forwarded file · 11:30",
    body: "Why it matters: direct market map with investment and competitor notes."
  },
  {
    type: "Opportunity",
    title: "Agent Finance Demo Day",
    meta: "Deadline August 18, 2026",
    body: "Why it matters: aligned with agent payments, fundraising, and social commerce."
  }
]

const replies = [
  {
    type: "Reply",
    title: "Zoe Capital",
    meta: "hot relationship · time-sensitive",
    body: "Draft prepared. Ask about next diligence focus and confirm follow-up timing."
  },
  {
    type: "Reply",
    title: "Liu Yan",
    meta: "warm relationship · partnership lead",
    body: "Ask for budget, timeline, and what an ideal incubator partnership looks like."
  },
  {
    type: "Ignore",
    title: "Growth Rocket funnel article",
    meta: "low-signal marketing content",
    body: "Suppressed from digest unless repeated by trusted contacts."
  }
]

function renderCard(item) {
  const card = document.createElement("article")
  card.className = "card"
  card.innerHTML = `
    <div class="card-meta">
      <span>${item.type}</span>
      <span>${item.meta}</span>
    </div>
    <h3>${item.title}</h3>
    <p>${item.body}</p>
  `
  return card
}

const todayList = document.querySelector("#today-list")
today.forEach(item => todayList.appendChild(renderCard(item)))

const replyList = document.querySelector("#reply-list")
replies.forEach(item => replyList.appendChild(renderCard(item)))
