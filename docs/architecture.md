# Architecture

## Core model

```text
WeChat = Data Surface
DeepSeek = Brain
Tools = Hands
Memory = You
```

## Runtime graph

```text
User Intent
  |
  v
Agent Orchestrator
  |
  +--> Memory
  +--> Planner
  +--> Policy Gate
  |
  v
Tool Registry
  |
  +--> WeChat bridge tools
  +--> Content parsing tools
  +--> External action tools
  |
  v
Action Ledger
```

## Why this repo uses mock mode first

The hardest part is not demo UI or prompting. It is the boundary between:

- what a connector can legally and reliably see
- what the agent can infer from that material
- what the agent is allowed to do automatically

That is why this repo starts with:

- honest tool contracts
- a concrete policy gate
- local ranking and digest logic
- a bridge-ready interface rather than fake unsupported powers

