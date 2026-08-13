# Controlling your real WeChat via desktop UI automation

The iLink/ClawBot path gives you a **separate bot identity** — it can never touch
your own chats, groups, or contacts. If what you actually want is to drive **your
own WeChat account**, this plugin also ships a desktop UI-automation transport:
it types and clicks inside the WeChat desktop app that is already installed and
logged in on your Mac, and reads the screen back with OCR.

This is RPA (interface automation), **not** protocol reverse-engineering and
**not** client hooking. It operates the real app the same way your fingers would.

## What it can do

| Tool | Action | Gate |
|---|---|---|
| `wechat_desktop_status` | Check the environment (WeChat.app, cliclick, screen-recording, OCR) | Green |
| `wechat_desktop_focus` | Bring WeChat to the front | Green |
| `wechat_desktop_read` | Screenshot + OCR the current screen to read what is visible | Green |
| `wechat_desktop_send` | Type a message and send it to a contact | **Yellow** (needs `confirm:true`) |

## Prerequisites (macOS)

1. **WeChat desktop app** installed and logged in (`/Applications/WeChat.app`).
2. **cliclick** — `brew install cliclick`.
3. **macOS permissions** for the terminal that runs dsh (System Settings →
   Privacy & Security):
   - **Accessibility** — lets cliclick move the mouse and type.
   - **Screen Recording** — lets `screencapture` grab the screen for OCR.
   Restart the terminal after granting.
4. **Build the OCR helper** (uses the built-in Vision framework, no downloads):

   ```sh
   npm run build:ocr    # compiles src/ocr.swift → src/ocr
   ```

## Configuration

In your dsh profile patch, add a `desktop` block (all keys optional):

```yaml
- insert:
    - id: deepseek-wechat-operator
      name: dsh-plugin-deepseek-wechat-operator
      config:
        mode: mock            # or bridge — desktop tools work regardless
        desktop:
          wechatApp: WeChat
          cliclickPath: /opt/homebrew/bin/cliclick
          ocrPath: ""          # defaults to the compiled src/ocr
```

## Using it from conversation

Ask the agent to `wechat_desktop_status` first — if anything is missing it will
tell you exactly what to enable. Then:

- “帮我给**文件传输助手**发一句：测试” — drafts, asks for confirmation, then sends.
- “看看我微信现在屏幕上有什么” — screenshot + OCR the current screen.

Sending is **Yellow**: the agent always confirms the exact contact + text with
you before it passes `confirm:true`. It never sends on its own.

## Honest boundaries

- `wechat_desktop_send` is a keyboard flow: `Cmd+F` search → Enter opens the
  first match → type → Enter sends. Contact names must be distinctive enough to
  match uniquely; UI redesigns can break the sequence (edit the steps in
  `src/desktop.js`).
- `wechat_desktop_read` OCRs the **whole screen** (WeChat should be frontmost),
  so output includes menu/other-window noise. It is a best-effort read, not a
  structured message API.
- If you set “Ctrl+Enter to send” in WeChat, change `desktop.sendKey` (or edit
  the last `kp:return` to `kp:ctrl+return`).
- WeChat’s own terms may still restrict automation of any kind; UI automation is
  far lower-risk than reverse-engineering or hooking, but it is not zero-risk.
  Use on your own account, at your own discretion.
