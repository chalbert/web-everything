---
bornAs: xdjixqt
kind: story
size: 3
status: open
blockedBy: ["2678"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/check-standards.mjs"]
dateOpened: "2026-07-28"
tags: []
---

# Implement the soft-warn size+collision file-size gate in check:standards (#2678 ruling)

Implement the soft-warn gate ratified in #2678 (fork 1 = (b)). Add a check:standards rule that WARNS (never errors, never denies) when a file is BOTH oversized AND scope-collision-heavy — keyed on a size+collision composite (code lines excluding comments/blank, times the count of queued items naming the file in their scope:), NOT raw line count. Honor an in-file `// @cohesive: <reason>` escape-hatch comment that silences the warn for a genuinely-cohesive large file. Wire the rule into we:scripts/check-standards-rules.mjs (called from we:scripts/check-standards.mjs). Tests: flagged (large+contended), quiet (large+@cohesive), quiet (large+uncontended), quiet (small). Statute: we:docs/agent/platform-decisions.md#small-file-preference.
