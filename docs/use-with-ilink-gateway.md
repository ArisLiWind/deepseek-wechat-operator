# Using with iLink Gateway

This repository is designed to sit next to a WeChat iLink-compatible gateway, not to hide the gateway requirement.

## Recommended topology

```text
iLink / ClawBot
  -> long poll or webhook
iLink gateway
  -> POST /ingest/ilink
DeepSeek WeChat Operator bridge
  -> GET /items
dsh plugin
  -> digest / find / rank / draft replies
```

## Why this shape

Current public iLink-compatible references indicate:

- inbound messages are obtained through long polling
- replies require the `context_token` from an inbound message
- practical gateways persist cursors and token caches

That makes a gateway-plus-bridge split more reliable than pretending the plugin alone can own the full transport layer.

## Example

1. Run an iLink-compatible gateway.
2. Forward its inbound webhook or buffered update payloads into `POST /ingest/ilink`.
3. Configure the plugin in `bridge` mode.
4. Ask `dsh` to digest or rank the accessible surface.

