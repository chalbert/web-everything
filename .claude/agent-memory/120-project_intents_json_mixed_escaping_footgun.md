---
name: project_intents_json_mixed_escaping_footgun
description: src/_data/intents.json mixes literal-UTF8 and \uXXXX escaping; never JSON.stringify-roundtrip the whole file — splice only changed entries
metadata: 
  node_type: memory
  type: project
  originSessionId: a37f1971-8ef6-45bb-9e58-98e1fe2d2fe2
---

`src/_data/intents.json` is **inconsistently escaped**: some entries store non-ASCII chars
literally (`—`, `–`), others as `\uXXXX` escapes — the file was hand/tool-edited over time with
different serializers. There is no single style.

**Why:** a naive `JSON.parse` → `JSON.stringify(obj, null, 2)` round-trip to edit one entry
normalizes the escaping of **every** entry, producing a massive spurious file-wide diff (touched
~22 unrelated intents in one incident) even though the content is semantically identical. ASCII-only
re-escaping doesn't fix it either, because the original is mixed per-entry.

**How to apply:** to edit an intent programmatically, **splice — don't re-serialize the whole file.**
Read HEAD's raw text, walk it with a brace-counter to capture each top-level entry's exact substring,
and emit fresh `JSON.stringify` output **only** for the entries you actually changed; reuse HEAD's
original bytes verbatim for untouched entries. That keeps the diff localized to the entries you
touched. (Same caution likely applies to any other `src/_data/*.json` authored this way — check before
round-tripping.) Verify with a per-entry byte comparison vs HEAD. Relevant to the
[[feedback_plain_language_review_checklists]] discipline of keeping changes reviewable.
