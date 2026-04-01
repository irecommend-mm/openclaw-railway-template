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

<!-- gog-docs-skill v1 -->

# gog Docs (manual mode)

Use `gog` CLI for Google Docs operations in this workspace.

## Preflight

Run before docs actions:

```bash
gog --account a.komyat@gmail.com drive ls --limit 5
```

If auth is missing, run:

```bash
gog auth credentials ~/.config/gogcli/credentials.json
gog auth add a.komyat@gmail.com --services drive,gmail,calendar,contacts
```

## Read docs

```bash
gog --account a.komyat@gmail.com docs info <DOC_ID>
gog --account a.komyat@gmail.com docs cat <DOC_ID>
```

## Write docs (confirm first)

```bash
gog --account a.komyat@gmail.com docs write <DOC_ID> "Updated content"
gog --account a.komyat@gmail.com docs insert <DOC_ID> "New paragraph" --index 0
```

## Rules

- Always use `--account a.komyat@gmail.com`.
- For write/update/insert/delete, show draft and ask user confirmation unless user explicitly says "write now".
- If a command fails, report the exact command error and next step.
- Do not suggest Python libraries or Dockerfile edits for docs tasks.
