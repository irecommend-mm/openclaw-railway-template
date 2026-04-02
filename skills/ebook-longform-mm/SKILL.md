---
name: ebook-longform-mm
description: >-
  Build long-form Myanmar ebooks in professional Amazon-style structure and write
  chapter-by-chapter to the same Google Doc with persistent TOC, outline, and
  progress state. Use when user asks for full ebook drafting, chapter plans,
  phased writing, or 60k-100k word manuscript generation.
metadata:
  openclaw:
    requires:
      bins: ["curl", "python3"]
---

<!-- ebook-longform-mm-skill v1 -->

# Myanmar Longform Ebook Writer (Amazon-style)

Use this for book projects targeting ~60,000 to 100,000 words (roughly 200-300 pages depending on trim/font/layout).

## Core promise

- Keep one consistent book identity: title, audience, tone, TOC, chapter order, formatting style.
- Write in **phases** and **chapters**, not one massive dump.
- Persist project memory so later runs continue correctly.
- Write directly to the same Google Doc via wrapper APIs (no manual copy mode unless user asks).

## Project state files

Store and update these in workspace:

- `data/ebook-projects/<project_slug>.json` (master state)
- `data/ebook-projects/<project_slug>-style.md` (voice + formatting guide)
- `data/ebook-projects/<project_slug>-toc.md` (stable TOC)

Minimum JSON fields:

```json
{
  "projectSlug": "example-book",
  "docId": "GOOGLE_DOC_ID",
  "language": "my-MM",
  "targetWords": 80000,
  "targetPages": "200-300",
  "bookTitle": "...",
  "subtitle": "...",
  "audience": "...",
  "tone": "...",
  "currentPhase": "phase-1",
  "chapters": [
    { "no": 1, "title": "...", "targetWords": 3500, "status": "done" }
  ],
  "completedWordsApprox": 0,
  "lastUpdated": "ISO8601"
}
```

## Standard book structure (always include)

1. Intro / Introduction
2. For Whom (target readers)
3. What You Will Learn
4. Table of Contents (TOC)
5. Chapter lessons (every chapter has key lessons + practical steps)
6. Conclusion
7. Acknowledgement

## Phase workflow

### Phase 0 - Setup

1. Confirm `docId`, topic, audience, tone, target words/pages.
2. Create/refresh state JSON + style + TOC files.
3. Write front matter shell to doc using `replace-body` when starting a fresh manuscript.

### Phase 1 - Blueprint

Generate:
- Positioning (problem, promise, transformation)
- Detailed TOC (10-20 chapters)
- Per-chapter target words
- Quality rules (Myanmar clarity, examples, consistency)

Write blueprint to doc and update state.

### Phase 2+ - Chapter production loop

For each chapter:
1. Draft chapter outline (goals, key lessons, examples, recap).
2. Draft full chapter in Myanmar language with professional tone.
3. Add mini elements: opening hook, lesson blocks, action checklist, summary.
4. Append to doc.
5. Update state (`status`, `completedWordsApprox`, timestamp).
6. Return progress report.

## Writing format per chapter

Use consistent structure:

- `အခန်း (N): <chapter title>`
- `ရည်မှန်းချက်များ` (chapter goals)
- `အဓိကသင်ခန်းစာများ` (core lessons)
- `အသုံးချနမူနာများ` (examples/case)
- `လက်တွေ့လေ့ကျင့်ရန်` (action steps)
- `အကျဉ်းချုပ်` (chapter summary)

## Google Docs write commands (preferred)

Base URL: `http://127.0.0.1:${PORT:-8080}`

Append chapter text:

```bash
python3 -c 'import json,sys; print(json.dumps({"docId":sys.argv[1],"text":open(sys.argv[2],encoding="utf-8").read()},ensure_ascii=False))' "$DOC_ID" /tmp/chapter.txt | \
curl -s -X POST "http://127.0.0.1:${PORT:-8080}/__railway/google/docs/append" \
  -H "Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @-
```

Replace full manuscript (only for reset/rewrite):

```bash
python3 -c 'import json,sys; print(json.dumps({"docId":sys.argv[1],"text":open(sys.argv[2],encoding="utf-8").read()},ensure_ascii=False))' "$DOC_ID" /tmp/manuscript.txt | \
curl -s -X POST "http://127.0.0.1:${PORT:-8080}/__railway/google/docs/replace-body" \
  -H "Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @-
```

Rewrite only one chapter/section by heading markers:

```bash
python3 -c 'import json,sys; print(json.dumps({"docId":sys.argv[1],"startHeading":sys.argv[2],"endHeading":sys.argv[3],"newSectionText":open(sys.argv[4],encoding="utf-8").read()},ensure_ascii=False))' "$DOC_ID" "အခန်း (၄): ..." "အခန်း (၅): ..." /tmp/chapter-4.txt | \
curl -s -X POST "http://127.0.0.1:${PORT:-8080}/__railway/google/docs/section-rewrite" \
  -H "Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @-
```

## Strict execution rules

- Do not switch TOC style halfway unless user explicitly approves.
- Do not change audience/tone without logging it in state.
- Never claim write success unless API JSON has `"ok": true`.
- If chapter is very long, write to `/tmp/chapter.txt` first and send via file payload.
- If user says “continue”, resume from first `status != done` chapter.
- If user says “rewrite chapter X”, update only that chapter section and record revision note.
- Do not tell user to copy/paste into Google Docs unless explicitly asked for manual mode.

## Parallel-agent guidance

This skill can run as a dedicated writing agent while other agents do general tasks.

When asked to run separately, keep all book progress in `data/ebook-projects/*.json` so any future run can continue chapter-by-chapter without losing TOC, format, or phase state.
