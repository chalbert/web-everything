---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["588"]
dateOpened: "2026-06-14"
relatedReport: reports/2026-06-14-inline-trigger-mention-pattern.md
tags: [candidate-standard, intent, block, mention, build]
---

# Build the inline-trigger detection block + intent

Build the ratified inline-trigger standard (#591): a runnable trigger-detection block (boundary-anchored char match -> query slice -> caret anchor -> route to results) plus an intent for the declarative dimensions (trigger-set registry, boundary/query policy, most-permissive defaults). Detection-only per #591 Fork 2-A: emit the resolved selection {key, query, range, item}; the consumer commits. Composes the general picker surface (#588) for results and the anchor intent for caret tethering. Ships reference insertion adapters for text (default) and token (composes #590), owning neither commit. Forced invariants: APG editable-combobox virtual focus, IME-composition suspension, not-a-protocol. blockedBy #588 (results surface).
