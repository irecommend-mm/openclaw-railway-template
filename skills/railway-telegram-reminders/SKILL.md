---
name: railway_telegram_reminders
description: >-
  Railway template: schedule Telegram reminders from natural-language times
  (e.g. "in 10 minutes", "at 12am", "tomorrow 9am") via the wrapper API and
  data/reminders.json. Use when the user asks to be reminded, pinged, or
  notified later on Telegram and you have their numeric chat id; otherwise
  fall back to openclaw cron with --channel last.
---

<!-- openclaw-railway-template-skill: railway-telegram-reminders v1 -->

# Railway Telegram reminders (file + chrono)

This skill applies only on the **Railway wrapper** deployment: the Node process parses **when** with **chrono-node**, stores rows in **`data/reminders.json`** under the OpenClaw workspace, and sends Telegram messages on a short poll using the bot token already in **`openclaw.json`** (`channels.telegram`). It does **not** patch OpenClaw core; it uses normal workspace **`skills/`** and the wrapper HTTP API.

## When to apply

- User wants a **timed reminder** in **plain language** on **Telegram**.
- You can obtain the **numeric Telegram `chatId`** for this DM (session/channel metadata, or equivalent).
- If **`chatId` is unknown**, use **`openclaw cron add`** with **`--channel last`** (see **CRON_REMINDERS.md** in the workspace root).

## Do not

- Tell the user a reminder is “set” until the **`curl` below returns `ok: true`** (or cron succeeded). Chat-only confirmation is not enough.

## Register a reminder

Run from a shell **inside the same container** as the gateway (agent exec / cron / session), with workspace env as usual:

```bash
curl -sS -X POST "http://127.0.0.1:${PORT:-8080}/__railway/reminder" \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Sleep","when":"in 10 minutes","chatId":"YOUR_CHAT_ID"}'
```

- **`text`**: what to remind (user-facing).
- **`when`**: natural language; examples: `in 5 min`, `in 10 minutes`, `at 12am`, `tomorrow 9am`, `2026-03-30 11:02`.
- **`chatId`**: Telegram chat id string or number for the user.

**Timezone:** set **`OPENCLAW_USER_TIMEZONE`** on Railway (and/or **`agents.defaults.userTimezone`**) so wall-clock phrases like **`12am`** match the user’s local day.

## Cancel

By id (from the JSON response):

```bash
curl -sS -X POST "http://127.0.0.1:${PORT:-8080}/__railway/reminder/cancel" \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"REMINDER_UUID"}'
```

By text snippet (first active match for that chat):

```bash
curl -sS -X POST "http://127.0.0.1:${PORT:-8080}/__railway/reminder/cancel" \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"sleep","chatId":"YOUR_CHAT_ID"}'
```

## Storage

- **File:** `data/reminders.json` (workspace root + `data/`).
- **Polling:** configurable via **`RAILWAY_REMINDER_POLL_MS`** (default 30s, min 5s).

## Pairing / auth errors on cron fallback

If **`openclaw cron`** complains about device pairing, use **`--token "$OPENCLAW_GATEWAY_TOKEN"`** or ensure the template set **`gateway.controlUi.dangerouslyDisableDeviceAuth=true`** (Apply reminder defaults).
