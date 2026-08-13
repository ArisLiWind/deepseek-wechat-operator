// Demo chat records for the social-profile dashboard — used by `npm run social`
// so you can see the visualization before feeding your own data. Purely
// synthetic; replace with your own export to get a real profile.

const DAY = 86400000
const now = Date.now()
const at = daysAgo => now - daysAgo * DAY

export const demoSocialRecords = [
  // 张三 —— 聊得多，兴趣：投资 / AI / 创业
  { from: "张三", to: "我", text: "最近大盘行情怎么样，能加仓吗", ts: at(2) },
  { from: "我", to: "张三", text: "我倾向再等等，别追高", ts: at(2) },
  { from: "张三", to: "我", text: "你那个大模型项目融资谈得怎么样了", ts: at(5) },
  { from: "张三", to: "我", text: "我看了下 deepseek 的行情，感觉可以关注", ts: at(9) },
  { from: "我", to: "张三", text: "对，AI 这条线我一直拿着", ts: at(9) },
  { from: "张三", to: "我", text: "周末一起吃个火锅，顺便聊聊创业的事", ts: at(12) },

  // 李四 —— 中等，兴趣：健身 / 游戏
  { from: "李四", to: "我", text: "今晚开黑吗，王者五排差一个", ts: at(1) },
  { from: "我", to: "李四", text: "今晚有会，改天", ts: at(1) },
  { from: "李四", to: "我", text: "最近在撸铁，感觉体重没降啊", ts: at(6) },
  { from: "李四", to: "我", text: "你那个跑步计划还在坚持吗", ts: at(20) },

  // 王五 —— 很久没联系（不常聊天）
  { from: "王五", to: "我", text: "老同学，好久不见，最近忙啥呢", ts: at(60) },
  { from: "我", to: "王五", text: "瞎忙，你呢", ts: at(60) },

  // 赵六 —— 很久没联系，兴趣：房产
  { from: "赵六", to: "我", text: "听说你买房了？首付凑齐了吗", ts: at(90) },
  { from: "赵六", to: "我", text: "最近楼盘价格好像降了点", ts: at(95) },

  // 陈七 —— 兴趣：旅行 / 美食
  { from: "陈七", to: "我", text: "国庆去日本玩吗，一起订机票", ts: at(30) },
  { from: "陈七", to: "我", text: "上次那家火锅店还想去，周末探店？", ts: at(33) },
  { from: "我", to: "陈七", text: "可以，你定", ts: at(33) },
  { from: "陈七", to: "我", text: "签证我已经办了，攻略发你", ts: at(40) },

  // 孙八 —— 兴趣：育儿
  { from: "孙八", to: "我", text: "你家娃上幼儿园了吗，我家刚报上", ts: at(45) },
  { from: "我", to: "孙八", text: "上了，辅导班你报了吗", ts: at(45) },
  { from: "孙八", to: "我", text: "还没，正纠结要不要报英语", ts: at(48) },

  // 周九 —— 基本没联系（最不常聊天）
  { from: "周九", to: "我", text: "新年快乐", ts: at(200) }
]

export function getDemoSocialRecords() {
  return demoSocialRecords.map(r => ({ ...r }))
}
