---
name: gog-docs
description: >-
  Manage Google Docs from the CLI using gog in manual mode. Use for reading
  document metadata/content and writing/updating docs after user confirmation.
metadata:
  openclaw:
    requires:
      bins: ["gog"]
---

<!-- gog-docs-skill v4 -->

# Google Gmail + Docs (env-token mode)

Use direct Google APIs via `curl` with Railway variables. This avoids fragile `gog auth add` browser flow in headless Railway.

## Required Railway variables

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_USER` (account email, e.g. `a.komyat@gmail.com`)

## Preflight check (run first)

```bash
test -n "$GMAIL_CLIENT_ID" && test -n "$GMAIL_CLIENT_SECRET" && test -n "$GMAIL_REFRESH_TOKEN" && test -n "$GMAIL_USER"
```

## Access token helper

Always create token first:

```bash
ACCESS_TOKEN=$(curl -s https://oauth2.googleapis.com/token \
  -d client_id="$GMAIL_CLIENT_ID" \
  -d client_secret="$GMAIL_CLIENT_SECRET" \
  -d refresh_token="$GMAIL_REFRESH_TOKEN" \
  -d grant_type=refresh_token | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
```

## Simple user commands mapping

When user asks these natural commands, run the mapped shell exactly:

- `google gmail latest 3`

```bash
ACCESS_TOKEN=$(curl -s https://oauth2.googleapis.com/token \
  -d client_id="$GMAIL_CLIENT_ID" \
  -d client_secret="$GMAIL_CLIENT_SECRET" \
  -d refresh_token="$GMAIL_REFRESH_TOKEN" \
  -d grant_type=refresh_token | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3&q=in:inbox"
```

- `google docs read <DOC_ID>`

```bash
DOC_ID="<DOC_ID>"
ACCESS_TOKEN=$(curl -s https://oauth2.googleapis.com/token \
  -d client_id="$GMAIL_CLIENT_ID" \
  -d client_secret="$GMAIL_CLIENT_SECRET" \
  -d refresh_token="$GMAIL_REFRESH_TOKEN" \
  -d grant_type=refresh_token | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
"https://docs.googleapis.com/v1/documents/$DOC_ID"
```

- `google docs create "<TITLE>"`

```bash
TITLE="New Document"
ACCESS_TOKEN=$(curl -s https://oauth2.googleapis.com/token \
  -d client_id="$GMAIL_CLIENT_ID" \
  -d client_secret="$GMAIL_CLIENT_SECRET" \
  -d refresh_token="$GMAIL_REFRESH_TOKEN" \
  -d grant_type=refresh_token | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
curl -s -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
"https://docs.googleapis.com/v1/documents" \
-d "{\"title\":\"$TITLE\"}"
```

- `google docs write <DOC_ID> "<TEXT>"`

```bash
DOC_ID="<DOC_ID>"
TEXT="Hello from OpenClaw"
ACCESS_TOKEN=$(curl -s https://oauth2.googleapis.com/token \
  -d client_id="$GMAIL_CLIENT_ID" \
  -d client_secret="$GMAIL_CLIENT_SECRET" \
  -d refresh_token="$GMAIL_REFRESH_TOKEN" \
  -d grant_type=refresh_token | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
curl -s -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
"https://docs.googleapis.com/v1/documents/$DOC_ID:batchUpdate" \
-d "{\"requests\":[{\"insertText\":{\"location\":{\"index\":1},\"text\":\"$TEXT\"}}]}"
```

## Rules

- Prefer env-token API flow over `gog auth add` in Railway.
- Do not suggest service-account JSON upload to GitHub.
- For write actions, execute directly when user asks to write to document. Use draft mode only if user explicitly asks for draft/review first.
- Never claim success unless command output confirms success.
- For docs writes/updates, always do post-write verification (`docs read` or metadata check) before replying "done".
- If a command fails, reply with raw stderr/json and mark the action as failed (do not switch to fallback narrative).
- If user says "send/push now", execute immediately and still return verification output.
- Never answer with "copy this manually into docs" unless user explicitly asks for manual mode.

## Robust docs write (for long text)

For long paragraphs, do not inline huge JSON in shell. Use python to build payload safely:

```bash
DOC_ID="<DOC_ID>"
TEXT="$(cat <<'EOF'
<LONG_TEXT_HERE>
EOF
)"
ACCESS_TOKEN=$(curl -s https://oauth2.googleapis.com/token \
  -d client_id="$GMAIL_CLIENT_ID" \
  -d client_secret="$GMAIL_CLIENT_SECRET" \
  -d refresh_token="$GMAIL_REFRESH_TOKEN" \
  -d grant_type=refresh_token | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
python3 - <<'PY' > /tmp/docs-payload.json
import json, os
doc_id = os.environ["DOC_ID"]
text = os.environ["TEXT"]
payload = {"requests":[{"insertText":{"location":{"index":1},"text":text}}]}
print(json.dumps(payload, ensure_ascii=False))
PY
curl -s -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
"https://docs.googleapis.com/v1/documents/$DOC_ID:batchUpdate" \
-d @/tmp/docs-payload.json
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
"https://docs.googleapis.com/v1/documents/$DOC_ID?fields=documentId,title"
```
