# DeepSeek WeChat Operator

[English](./README.md)

`DeepSeek WeChat Operator` 让你在接入 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 之后，直接用自然语言操作自己的微信信息流。你可以把**用户明确授权、官方通道可拿到、你主动转发给 Agent 的微信信息**交给 DeepSeek，然后立刻做到这些事情：

- 问它：“今天我微信里最值得我看的 10 件事是什么？”
- 找它：“老王上个月发我的那份 PDF 在哪？”
- 让它判断：“今天最值得我回复的是哪 5 个人？”
- 让它整理：“最近 7 天别人发给我的岗位、融资、合作机会全部汇总出来。”
- 让它起草：“帮我回复第三个人，说我感兴趣，但先问清楚预算和时间。”

有了 DeepSeek Harness 之后，这个项目提供的就是一层面向微信世界的 Agent 操作能力：读取、筛选、检索、总结、规划，再把可以做的动作排好优先级，交给你确认或执行。

一句话定位：

> DeepSeek for WeChat — Read everything that matters. Do what needs to be done.

中文版可以直接写成：

> 让 DeepSeek 接管你的微信信息工作。

## 当前可接入的信息

第一版围绕这些入口工作：

- 用户主动转发给 Agent 的消息、文章、文件和链接
- 通过 iLink / ClawBot 官方 Bot 通道真实送达的事件
- 用户显式授权抓取的公开链接
- Agent 可以处理的 PDF、Word、Excel、图片、语音等内容

## 产品核心

第一版只保留六个核心动作：

- `Ask`：问我的微信世界任何问题
- `Find`：找消息、文件、人、机会、文章
- `Digest`：把高噪声信息压成真正值得看的少数项
- `Act`：准备回复、整理结果、生成下一步动作
- `Send`：在确认后把回复真正发出去（Yellow 门控）
- `Automate`：沉淀长期过滤规则和日/周摘要

Hero Feature 不是“AI 控制微信”，而是：

**每天把我今天能接触到的微信世界，压缩成真正值得我注意的 10 件事。**

## 仓库里已经有什么

- [`src/index.js`](./src/index.js)：可装载到 `dsh` 的插件入口
- [`src/bridge-server.js`](./src/bridge-server.js)：真实事件桥接层，本地 HTTP 服务
- [`src/bridge-service.js`](./src/bridge-service.js)：桥接层读写客户端
- [`src/normalize.js`](./src/normalize.js)：把 iLink / gateway webhook 归一化成 Agent 可读对象
- [`web/index.html`](./web/index.html)：Command Center 演示页
- [`assets/social-card.svg`](./assets/social-card.svg)：仓库分享素材
- [`docs/x-post.md`](./docs/x-post.md)：可直接发的 X 帖子草稿

## 已实现的能力

当前已经有 6 个核心动作：

- `wechat_digest_world`
- `wechat_find`
- `wechat_rank_replies`
- `wechat_prepare_reply`
- `wechat_plan_automation`
- `wechat_send_message`（Yellow 门控：需 `confirm:true` 才会派发）

其中 `bridge` 模式已经可以直接接真实事件：

- 可以接收真实 webhook/轮询转发事件（含 iLink 原始 `WeixinMessage` 形态）
- 会缓存每个用户最近的 `context_token`
- 能把事件转成统一的 `accessible items`（text / image / voice / file / video）
- 能验证“收到消息后再回复”这条 iLink 约束
- 出站默认 `record-only`（只落盘不发送）；设置
  `WECHAT_OPERATOR_OUTBOUND=ilink-gateway` 后才会把回复真正 POST 到网关上

真实收发微信消息需要另一个 iLink/ClawBot 网关，见
[`docs/use-with-ilink-gateway.md`](./docs/use-with-ilink-gateway.md)；接入 dsh 见
[`docs/install-into-dsh.md`](./docs/install-into-dsh.md)。

## 如何本地跑起来

### 1. 启动桥接层

```sh
cd deepseek-wechat-operator
WECHAT_OPERATOR_API_KEY=demo-key npm run bridge:dev
```

默认监听 `http://127.0.0.1:3468`。

### 2. 推送一条真实格式的入站事件

```sh
curl -X POST http://127.0.0.1:3468/ingest/ilink \
  -H 'Authorization: Bearer demo-key' \
  -H 'Content-Type: application/json' \
  --data @examples/bridge-event.ilink.json
```

### 3. 查看桥接层已经拿到的可访问对象

```sh
curl http://127.0.0.1:3468/items \
  -H 'Authorization: Bearer demo-key'
```

### 4. 在 `dsh` 里用桥接模式

参考 [`examples/cordis.bridge.patch.yml`](./examples/cordis.bridge.patch.yml)：

```yaml
- insert:
    - id: deepseek-wechat-operator
      name: dsh-plugin-deepseek-wechat-operator
      config:
        mode: bridge
        bridgeUrl: http://127.0.0.1:3468
        bridgeApiKey: demo-key
        digestLimit: 10
        minimumScore: 0.45
```

然后就可以在 `dsh` 里直接问：

- “把今天最值得我看的 10 件事整理出来”
- “谁今天最值得我回复？”
- “把最近 7 天提到岗位、融资、合作的消息找出来”

## 权限模型

- `Green`：读取、总结、分类、搜索、去重、保存、写入个人知识库
- `Yellow`：发消息、转发文件、改任务、写日历、批量动作前先确认
- `Red`：付款、删除关键数据、公开发布、发敏感文件、账号安全类动作强确认

## 本地验证方式

```sh
npm run check
```

它会依次执行：

- `node --test`
- `node ./src/demo.js`
- `node ./src/e2e-demo.js`
- `npm pack --dry-run`

## 参考的 iLink 事实

这个仓库的桥接层设计，明确遵守了当前可见的 iLink / gateway 事实：

- iLink 消息接收是长轮询，不是 WebSocket
- 每条回复都依赖入站消息里的 `context_token`
- gateway 可以把入站消息缓冲或 webhook 推送出来

相关资料：

- [wechatbot.dev 协议说明](https://www.wechatbot.dev/zh/protocol)
- [Kadxy/weixin-ilink-gateway](https://github.com/Kadxy/weixin-ilink-gateway)
