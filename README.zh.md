# DeepSeek WeChat Operator

[English](./README.md)

`DeepSeek WeChat Operator` 是一个基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的公开 `dsh-plugin` 项目。它的目标不是“偷偷接管你的私人微信”，而是把**用户明确授权、官方通道可拿到、你主动转发给 Agent 的微信信息**，变成一个可以被 Agent 阅读、筛选、检索、总结、规划和执行的信息操作层。

一句话定位：

> DeepSeek for WeChat — Read everything that matters. Do what needs to be done.

中文版可以直接写成：

> 让 DeepSeek 接管你的微信信息工作。

## 这不是在承诺什么

第一版不会虚假承诺这些能力：

- 静默遍历你过去 5 年的私人聊天记录
- 稳定读取所有微信群历史消息
- 批量读取“我关注的全部公众号”的历史文章
- 像真人一样随意操控微信客户端 UI

这个仓库采取的是更诚实、也更可落地的边界：

- 用户主动转发给 Agent 的消息、文章、文件和链接
- 通过 iLink / ClawBot 官方 Bot 通道真实送达的事件
- 用户显式授权抓取的公开链接
- Agent 可以合法处理的 PDF、Word、Excel、图片、语音等内容

## 产品核心

第一版只保留五个核心动作：

- `Ask`：问我的微信世界任何问题
- `Find`：找消息、文件、人、机会、文章
- `Digest`：把高噪声信息压成真正值得看的少数项
- `Act`：准备回复、整理结果、生成下一步动作
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

## 已实现的插件能力

当前插件提供 5 个模型可调用工具：

- `wechat_digest_world`
- `wechat_find`
- `wechat_rank_replies`
- `wechat_prepare_reply`
- `wechat_plan_automation`

其中 `bridge` 模式已经不是占位：

- 可以接收真实 webhook/轮询转发事件
- 会缓存每个用户最近的 `context_token`
- 能把事件转成统一的 `accessible items`
- 能验证“收到消息后再回复”这条 iLink 约束

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

