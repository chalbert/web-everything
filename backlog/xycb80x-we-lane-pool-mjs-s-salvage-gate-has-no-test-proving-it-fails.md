---
kind: task
parent: "4075"
status: open
blockedBy: ["4273"]
scope: ["we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# we:lane-pool.mjs's salvage gate has no test proving it fails closed when newestContentMtimeMs throws

#4273 widened we:scripts/lib/lane-salvage.mjs's newestContentMtimeMs so it now THROWS on an unreadable/unregistered .claude/worktrees/ entry, where it previously always swallowed stat errors. we:scripts/lane-pool.mjs's cmdReclaimSalvage gate() already wraps that call in a try/catch that treats any thrown error as 'changed just now' (fail-closed, refusing salvage) — confirmed by reading the source at the time of #4273 — but no test anywhere exercises that composition; cmdReclaimSalvage itself is not exported and has zero existing test coverage. Surfaced by an automated review during #4273's build (correctness/standards-conformance/claim-accuracy lenses across multiple rounds, degraded impact, carve-out — not required to land #4273 itself, and #4273's own tests only MIRROR the gate's call shape from we:scripts/lib/lane-salvage.mjs's exports, which cannot detect a future drift in the real caller). Done when: a test exercises cmdReclaimSalvage's actual gate (or an exported/testable seam of it) with a stubbed/real newestContentMtimeMs throw and asserts the lane is correctly treated as not-quiet/not-reclaimed, closing the drift-detection gap the #4273 'mirror' test explicitly cannot.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
