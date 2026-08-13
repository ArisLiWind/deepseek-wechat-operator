# DeepSeek WeChat Operator

[English](./README.md) · [CI](https://github.com/ArisLiWind/deepseek-wechat-operator/actions/workflows/ci.yml) · [MIT](./LICENSE)

让 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）里的 Agent 接管你的微信信息流：读取、筛选、排序、起草，并且在**发消息前停下来跟你确认**。

一句话使用——装好后，你只需要说：

> **总管，帮我看一下微信。**

插件内置了「微信总管」人设：说这句话，它就自动 `digest → 排谁最该回 → 起草 → 发前确认`。发消息是 Yellow 门控，**绝不自动发**。

---

## 三步开始

### 第 1 步 · 验证它能跑（不需要 dsh、不需要微信）

```sh
git clone https://github.com/ArisLiWind/deepseek-wechat-operator.git
cd deepseek-wechat-operator
npm install
npm test          # 22 个测试全过 = 插件能正确加载、能执行
npm run demo:json # 用内置假数据跑一遍 digest / 排序 / 机会提取
```

### 第 2 步 · 挂进 dsh（`mock` 模式，先不碰真微信）

把插件包装进你的 profile（指向本地仓库路径）：

```sh
# 有 dsh CLI 的话：
dsh plugin --profile web add "file:$PWD"

# 或手动（DSH_HOME 默认 ~/.dsh）：
cd "$DSH_HOME/profiles/web" && pnpm add "file:$PWD"
```

再写入补丁 `$DSH_HOME/profiles/web/cordis.patch.yml`：

```yaml
- insert:
    - id: deepseek-wechat-operator
      name: dsh-plugin-deepseek-wechat-operator
      config:
        mode: mock
        digestLimit: 10
        minimumScore: 0.45
```

重启 dsh。

### 第 3 步 · 新会话里说一句

> **总管，帮我看一下微信。**

它会用 `mock` 模式里的假数据把整条链跑通（先证明插件通了，读的不是你的真微信）。更细的接入说明见 [`docs/install-into-dsh.md`](./docs/install-into-dsh.md)。

---

## 它能做什么

6 个工具（`src/index.js` 注册）：

| 工具 | 作用 | 门控 |
|---|---|---|
| `wechat_digest_world` | 把今天最值得看的压成少数几条 | Green |
| `wechat_find` | 按关键词找消息/文件/人/机会 | Green |
| `wechat_rank_replies` | 排谁最值得回复 | Green |
| `wechat_prepare_reply` | 给目标起草回复 + 返回审批级别 | Green |
| `wechat_plan_automation` | 把筛选意图转成自动化规则草稿 | Green |
| `wechat_send_message` | 真正发出回复 | **Yellow**（需 `confirm:true`） |

**诚实边界（重要）：**

- `mock` 模式读的是内置**假数据**，用于演示和开发。
- `bridge` 模式读真实入站事件，但**出站默认 `record-only`**——回复只落盘、不发送。
- 要**真正发出微信**，需要再跑一个 iLink/ClawBot 网关（装 Bun + 微信号扫码），见 [`docs/use-with-ilink-gateway.md`](./docs/use-with-ilink-gateway.md)。这不是本仓库能替你完成的，也不假装替你完成。

## 仓库结构

- [`src/index.js`](./src/index.js)：dsh 插件入口（6 个工具 + 微信总管人设）
- [`src/outbound.js`](./src/outbound.js)：出站适配器（`record-only` 默认 / `ilink-gateway` 真发送）
- [`src/normalize.js`](./src/normalize.js)：把 iLink `WeixinMessage` 归一化成可读对象
- [`src/bridge-server.js`](./src/bridge-server.js)：本地 HTTP 桥接层
- [`src/bridge-service.js`](./src/bridge-service.js)：桥接层读写客户端
- [`src/domain.js`](./src/domain.js)：digest / find / rank / draft 的纯逻辑
- [`src/policy.js`](./src/policy.js)：Green/Yellow/Red 权限分级
- [`integration/agent.cordis.patch.yml`](./integration/agent.cordis.patch.yml)：现成的 dsh 接入补丁
- [`integration/install-into-dsh.sh`](./integration/install-into-dsh.sh)：一键接入脚本（默认 dry-run）
- [`docs/install-into-dsh.md`](./docs/install-into-dsh.md)：接入 dsh 的完整步骤
- [`docs/use-with-ilink-gateway.md`](./docs/use-with-ilink-gateway.md)：接真实 iLink/ClawBot 网关

## 接真实微信（bridge 模式）

```sh
cd deepseek-wechat-operator
WECHAT_OPERATOR_API_KEY=demo-key npm run bridge:dev   # 监听 http://127.0.0.1:3468
```

推一条真实格式入站事件验证：

```sh
curl -X POST http://127.0.0.1:3468/ingest/ilink \
  -H 'Authorization: Bearer demo-key' -H 'Content-Type: application/json' \
  --data @examples/bridge-event.ilink.json
```

然后 patch 里把 `mode` 改成 `bridge`（补丁见 [`examples/cordis.bridge.patch.yml`](./examples/cordis.bridge.patch.yml)），在 dsh 里直接问「今天最值得我看的 10 件事是什么」。

要真正发消息，再设出站：

```sh
WECHAT_OPERATOR_OUTBOUND=ilink-gateway \
ILINK_GATEWAY_SEND_URL=http://127.0.0.1:3456/messages/send \
ILINK_GATEWAY_API_KEY=<网关的 key> \
npm run bridge:dev
```

完整链路见 [`docs/use-with-ilink-gateway.md`](./docs/use-with-ilink-gateway.md)。

## 权限模型

- `Green`：读取、总结、分类、搜索、去重、保存 —— 自动执行
- `Yellow`：发消息、转发文件、改任务、写日历、批量动作 —— **先确认**
- `Red`：付款、删除关键数据、公开发布、发敏感文件、账号安全 —— 强确认

## 本地验证

```sh
npm run check
```

依次执行 `node --test`、`demo`、`e2e-demo`、`perf-demo`、`npm pack --dry-run`。CI 在 push/PR 时自动跑这套。

## 参考的 iLink 事实

- iLink 消息接收是**长轮询**，不是 WebSocket
- 每条回复都依赖入站消息里的 `context_token`
- gateway 可以把入站消息缓冲或 webhook 推送出来

资料：[wechatbot.dev 协议](https://www.wechatbot.dev/zh/protocol) · [Kadxy/weixin-ilink-gateway](https://github.com/Kadxy/weixin-ilink-gateway) · [Tencent/openclaw-weixin](https://github.com/Tencent/openclaw-weixin)
