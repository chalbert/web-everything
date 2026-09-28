---
kind: task
status: open
scope: ["we:scripts/operations/probation-heal-run.mjs", "we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Wire --dry-run in the two probation run scripts (ci-heal + doc-fix build)

Both we:scripts/operations/probation-heal-run.mjs and we:scripts/operations/probation-build-run.mjs parse a --dry-run flag that nothing consults; a run always does the real claim/commit/push/PR-open regardless. Wire both together (never one alone, or they diverge further) to preview what would happen (worker pick, envelope fit) with no side effect, or remove the flag from both if a real preview is not worth building. Flagged repeatedly by the converge panel on #4291's plan review (simplicity/standards-conformance lenses).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
