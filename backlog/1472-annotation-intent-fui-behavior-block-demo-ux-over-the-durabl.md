---
kind: story
size: 8
status: open
blockedBy: ["1471"]
dateOpened: "2026-06-21"
tags: []
---

# annotation intent + FUI behavior block + demo — UX over the durable-range-anchor contract

Realizing build ratified by #1408 (Fork 2 split, UX half). Author the annotation intent JSON (UX-only): select content then attach a motivation payload (highlighting|commenting|tagging|suggestion) with an overlay disposition; COMPOSES the #1471 durable-range-anchor contract + selection / rich-text (in-model mark when editable) / anchor+popover / highlight-api. Owns no anchor machinery. Plus the FUI behavior block realization and a demo (highlight + comment over read-only HTML). Blocked by #1471 (can't import the anchor we:contract.ts until it lands). File via /new-standard. Orphaned-annotation is a first-class outcome; comment-thread product UI stays app-level.
