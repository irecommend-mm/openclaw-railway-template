---
name: gog-docs
description: >-
  Read Gmail and read/write Google Docs on Railway using OAuth env vars. Prefer
  the wrapper HTTP helpers (correct Docs indices); curl to Google APIs only as
  fallback.
metadata:
  openclaw:
    requires:
      bins: ["curl"]
---

<!-- gog-docs-skill v5 -->

# Google Gmail + Docs (Railway)

## Primary path: wrapper APIs (no wrong insert index)

This template exposes authenticated routes on **the same process** as OpenClaw. They refresh OAuth, compute the correct **append** index for Docs, and return JSON. **Use these first** on Railway — do not tell the user to copy-paste into Docs unless they explicitly want manual mode.

**Auth:** `Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN` (already set in the container).

**Base URL:** `http://127.0.0.1:${PORT:-8080}`

### Endpoints

| Action | Method | Path | JSON body |
|--------|--------|------|-----------|
| List inbox (or query) | POST | `/__railway/google/gmail/list` | `{ "maxResults": 10, "q": "in:inbox" }` |
| Read doc | POST | `/__railway/google/docs/get` | `{ "docId": "..." }` |
| Append to end of doc | POST | `/__railway/google/docs/append` | `{ "docId": "...", "text": "..." }` |
| Replace entire doc body | POST | `/__railway/google/docs/replace-body` | `{ "docId": "...", "text": "..." }` |
| Rewrite one section by headings | POST | `/__railway/google/docs/section-rewrite` | `{ "docId": "...", "startHeading": "...", "endHeading": "...", "newSectionText": "..." }` |

### Examples (run in the Railway shell / agent exec)

Small payload:

```bash
curl -s -X POST "http://127.0.0.1:${PORT:-8080}/__railway/google/docs/append" \
  -H "Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"docId\":\"YOUR_DOC_ID\",\"text\":\"Hello\"}"
```

Long text from file (avoids shell-escaping issues; uses `python3` from the image):

```bash
printf '%s' "$LONG_TEXT" > /tmp/gdoc-body.txt
python3 -c 'import json,sys; print(json.dumps({"docId":sys.argv[1],"text":open(sys.argv[2],encoding="utf-8").read()},ensure_ascii=False))' "$DOC_ID" /tmp/gdoc-body.txt | \
curl -s -X POST "http://127.0.0.1:${PORT:-8080}/__railway/google/docs/append" \
  -H "Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @-
```

**Rewrite / replace whole document** (same doc ID, new content):

```bash
python3 -c 'import json,sys; print(json.dumps({"docId":sys.argv[1],"text":open(sys.argv[2],encoding="utf-8").read()},ensure_ascii=False))' "$DOC_ID" /tmp/gdoc-body.txt | \
curl -s -X POST "http://127.0.0.1:${PORT:-8080}/__railway/google/docs/replace-body" \
  -H "Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @-
```

Gmail:

```bash
curl -s -X POST "http://127.0.0.1:${PORT:-8080}/__railway/google/gmail/list" \
  -H "Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"maxResults":5,"q":"in:inbox"}'
```

Reply **only after** the response JSON shows `"ok": true` and include the relevant `verify` / `batchUpdate` snippet. If `"ok": false`, paste `detail` and do not claim success.

---

## Required Railway variables

- `GMAIL_CLIENT_ID` (or `GOOGLE_CLIENT_ID`)
- `GMAIL_CLIENT_SECRET` (or `GOOGLE_CLIENT_SECRET`)
- `GMAIL_REFRESH_TOKEN` (or `GOOGLE_REFRESH_TOKEN`)
- `GMAIL_USER` (or `GOOGLE_ACCOUNT_EMAIL`) — account email

---

## Fallback: direct Google APIs with curl

Only if wrapper routes are unreachable. **Do not use `insertText` at index 1 for append** on non-empty docs — it causes API index errors. For append without the wrapper, `documents.get` first and insert at `endIndex - 1` of the body.

---

## Rules

- **Prefer** `/__railway/google/docs/append`, `/__railway/google/docs/section-rewrite`, and `/__railway/google/docs/replace-body` over raw `batchUpdate` from the agent.
- Do not suggest service-account JSON or Dockerfile edits for this flow.
- Never claim success unless the HTTP response has `"ok": true`.
- Never answer with “copy this into Google Docs” unless the user explicitly asks for manual mode.
- If a call fails, show the JSON error; do not switch to a fake-success narrative.
