---
name: meta-cli-fb
description: >-
  Manage a Facebook Page using meta-cli in manual mode. Use for drafting,
  publishing, and moderating Page content and replying to FAQs from a knowledge
  base. Always confirm with the user before posting/replying publicly unless
  explicitly asked to auto-post.
metadata:
  openclaw:
    requires:
      bins: ["meta-cli"]
---

<!-- meta-cli-fb-skill v1 -->

# meta-cli Facebook Page (manual mode)

You manage Facebook Pages through the Meta Graph API using `meta-cli`. This skill is **manual mode only**:

- Draft first, get user approval, then execute.
- Do **not** run long-lived daemons (`webhook serve --auto-reply`) unless the user explicitly asks later.

## One-time setup (first run on a new server)

### 1) OAuth login

If `meta-cli auth status` says you are not logged in, authorize:

```bash
meta-cli auth login --app-id "$META_APP_ID" --app-secret "$META_APP_SECRET"
```

- This will print an OAuth URL. Open it in your browser, approve, and complete the login.
- Tokens/config are stored under `~/.meta-cli/` (this Railway template persists that directory on the `/data` volume).

### 2) Select the Page to manage

```bash
meta-cli pages list --json
meta-cli pages set-default <PAGE_ID>
```

### 3) Quick health check (safe)

```bash
meta-cli auth status --json
meta-cli pages list --json
meta-cli pages info --json
```

## Preflight checks

Before attempting any action:

```bash
meta-cli auth status --json
meta-cli pages list --json
```

- If auth is missing/expired, tell the user you need to re-run `meta-cli auth login` (OAuth).
- If page isn’t selected, set the default page:

```bash
meta-cli pages set-default <PAGE_ID>
```

## Knowledge base (FAQ) workflow

For repeated questions:

1) Search KB:

```bash
meta-cli rag search "<question>" --top 5 --json
```

2) If relevant answer exists, draft a concise reply in the page’s tone.
3) If not found, mark as **Need human help** (don’t hallucinate). Ask the user what to reply.

## Messenger (manual replies)

Read context:

```bash
meta-cli messenger history --psid <PSID> --limit 30 --json
```

Draft the reply, then send (only after user approves, unless the user asked “reply now”):

```bash
meta-cli messenger send --psid <PSID> --message "<reply>"
```

## Posts (draft → approve → publish)

List recent posts:

```bash
meta-cli post list --limit 10 --json
```

Draft and publish text/link/photo/video posts:

```bash
meta-cli post create --message "Hello world!"
meta-cli post create --link https://example.com --message "Read this"
meta-cli post create --photo /path/to/image.jpg --message "Caption"
meta-cli post create --video /path/to/video.mp4 --title "Title" --message "Description"
```

Scheduling (use user timezone):

```bash
meta-cli post create --message "Coming soon!" --schedule "2026-03-20 14:00" --tz "Asia/Yangon"
meta-cli post list-scheduled --json
```

## Comments (moderation + replies)

List comments:

```bash
meta-cli comment list <POST_ID> --limit 50 --json
```

Reply (draft first, then send):

```bash
meta-cli comment reply <COMMENT_ID> --message "<reply>"
```

Moderate:

```bash
meta-cli comment hide <COMMENT_ID>
meta-cli comment unhide <COMMENT_ID>
meta-cli comment delete <COMMENT_ID>
```

Rule: **Hide** instead of delete unless obvious spam.

## Insights (reporting)

```bash
meta-cli insight page --json
meta-cli insight post <POST_ID> --json
```

## Rules

- Never claim something was posted/replied unless the command succeeded.
- Always show a draft and ask for confirmation for public actions unless the user explicitly requests immediate publish.
- Use `--json` when you need structured output for reasoning.
- Do not start webhook/daemon mode unless the user asks.

