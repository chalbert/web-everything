---
kind: task
status: open
dateOpened: "2026-08-05"
tags: [agent-memory, gate, check-standards]
---

# Gate bare #NNNN citations in agent-memory — PR numbers must be namespaced

A bare `#NNNN` in a memory leaf means a BACKLOG item — `we:scripts/lib/memory-freshness.cjs` already resolves
every match that way. But the backlog and PR counters currently overlap in the 1000s, so a PR written bare
resolves silently to an unrelated card. Found on the land-bar leaf, where `#1031`, `#1037` and `#1022` all hit
real-but-wrong items and the freshness audit stayed green. Add a signal to `we:scripts/lib/memory-freshness.cjs`
(it already owns the `#NNNN` namespace and the regex): warn on any bare `#NNNN` in a leaf body not prefixed by
a namespace token — `PR `, `WE `, `FUI `, `plateau-app `, `backlog `. `check:standards` already folds these in.

**Why non-blocking:** the corpus already uses prefixed forms (`PR #460`, `WE #558`) by convention; this makes
the convention machine-checked rather than recalled.

**Prevention for:** review finding on PR #1040 (correctness + standards lenses, independently).

**Locus:** `we:scripts/lib/memory-freshness.cjs`
