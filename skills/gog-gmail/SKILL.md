---
name: gog-gmail
description: >-
  Manage Gmail via gog CLI in manual mode. Use for listing latest emails,
  searching inbox, reading message details, and drafting replies with user
  confirmation before sending.
metadata:
  openclaw:
    requires:
      bins: ["gog"]
---

<!-- gog-gmail-skill v1 -->

# gog Gmail (manual mode)

Use `gog` CLI for Gmail actions in this workspace.

## One-time setup

If auth is missing, run:

```bash
gog auth login
```

Then verify:

```bash
gog whoami
```

## Safe preflight checks

Before Gmail actions, run:

```bash
gog whoami
```

If not logged in, ask user to complete `gog auth login` first.

## Common commands

Get latest inbox emails:

```bash
gog gmail list --limit 10
```

Search by keyword:

```bash
gog gmail list --query "from:example@company.com newer_than:7d" --limit 20
```

Read a message:

```bash
gog gmail read <MESSAGE_ID>
```

Draft a reply (confirm first):

```bash
gog gmail reply --message-id <MESSAGE_ID> --body "Draft reply text"
```

## Rules

- Do not claim an email was sent/replied unless command succeeded.
- For sending/replying, show draft first and ask for confirmation unless user explicitly says "send now".
- If command fails, report the exact failure and next step.
- Do not ask the user to change `HOME`, edit Dockerfile, or do runtime infra hacks for gog.
- This template already persists gog config via `/data/.config/gogcli`; focus on `gog auth login` and Gmail commands only.
