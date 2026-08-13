# X Post Draft

## Short version

Built a new plugin on top of DeepSeek Harness:

**DeepSeek WeChat Operator**

It turns accessible WeChat messages, files, links, and opportunities into an Agent-readable operating layer.

Not “AI secretly controls your private WeChat.”
More like:

- ask my WeChat world anything
- find the message / PDF / opportunity I forgot
- compress a day of noise into the 10 things that matter
- rank who I should reply to
- draft the reply, then wait for approval before sending

The first version is honest about the boundary:

- supports forwarded content
- supports accessible iLink / Bot events
- supports public links the user authorizes
- does **not** pretend to read every private chat or every公众号历史文章

I also added a real bridge layer:

- ingest inbound iLink-style webhook events
- normalize them into ranked objects
- cache `context_token`
- validate reply eligibility before outbound actions

Repo:
https://github.com/ArisLiWind/deepseek-wechat-operator

If you build with DeepSeek Harness and want a WeChat-facing personal Agent layer, this is ready to clone, inspect, and extend.

## Longer version

I’ve been exploring what a serious “DeepSeek for WeChat” product should actually look like.

Not a fake demo.
Not “AI controls your life.”
Not a risky client-hook story.

A real, policy-gated Agent layer on top of accessible WeChat information.

So I built:

**DeepSeek WeChat Operator**

It’s a new plugin built on top of DeepSeek Harness.

Core idea:

WeChat = data surface
DeepSeek = brain
Tools = hands
Memory = you

What it does right now:

1. `Digest`
Compress accessible WeChat inputs into the 10 things that actually matter.

2. `Find`
Search for messages, people, files, links, jobs, partnership leads, and opportunities.

3. `Reply ranking`
Rank who is actually worth responding to first.

4. `Reply drafting`
Draft a response, but require approval before sending.

5. `Automation planning`
Turn “keep agent-payments signal, suppress marketing noise” into a rule draft.

And importantly, I added a real event bridge:

- accepts iLink-style webhook payloads
- stores normalized objects locally
- caches `context_token` per user
- checks whether a reply is valid before recording/sending an outbound action

This is the repo:
https://github.com/ArisLiWind/deepseek-wechat-operator

If this direction is interesting to you, feel free to bookmark it, inspect the bridge layer, or fork it into your own Agent stack.

