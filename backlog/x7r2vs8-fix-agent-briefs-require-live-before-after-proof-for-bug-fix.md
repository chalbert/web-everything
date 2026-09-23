---
kind: task
status: resolved
scaffoldedBy: "fix-agent-brief-proof"
dateScaffolded: "2026-09-23"
scope: ["we:skills-src/conveyor", "we:agent-memory-src"]
dateOpened: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# Fix agent briefs require live before/after proof for bug fixes

Add a before/after reproduce-then-fix proof requirement to the conveyor fix-agent brief (and the delivery brief's build-a-bug-fix path), pinned with a grep test; add the matching agent-memory rule per operator instruction 2026-09-23 (epic #3383).

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/bug-fix-before-after-proof-rule.test.mjs`
   fails at the parent commit (the briefs lack the proof wording) and passes once
   `we:skills-src/conveyor/fix-agent-brief.md` and `we:skills-src/conveyor/delivery-agent-brief.md` carry it.
2. `we:agent-memory-src/worker-brief-requires-live-before-after-proof.md` exists and is indexed on
   `we:agent-memory-src/index-verif.md` directly after rule 129.
