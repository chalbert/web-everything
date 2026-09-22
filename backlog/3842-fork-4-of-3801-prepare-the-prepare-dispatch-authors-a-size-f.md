---
bornAs: xi8dngi
kind: story
size: 2
parent: "3717"
status: resolved
blockedBy: ["3839"]
scope: ["we:scripts/operations/prepare-scope-wrapper.mjs", "we:skills-src/conveyor/prepare-scope-agent-brief-v2.md", "we:scripts/operations/__tests__/prepare-scope-wrapper.test.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
graduatedTo: none
tags: []
---

# Fork 4 of #3801, prepare: the prepare dispatch authors a size for a story or the estimate field for a task, beside the scope it already authors

Ruled in #3801 Fork 4 (b), consequence 3: prepared for the dispatch gate means shaped plus sized, both authored by prepare. The prepare-scope wrapper (we:scripts/operations/prepare-scope-wrapper.mjs) and its one-turn brief (we:skills-src/conveyor/prepare-scope-agent-brief-v2.md) today author only scope:. This slice lets that turn also write a size: on a story or the task estimate field on a task, in the same one file, and the wrapper checks it.

**Home:** the prototype branch `lane/mechanical-dispatcher` (the wrapper and its v2 brief exist only there, checked on `5ab89f87b`). Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**Order:** `blockedBy` the Fork 4 field slice (the task estimate field it writes).

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/prepare-scope-wrapper.test.mjs` passes with new cases that fail before: (a) a prepare turn that writes `scope:` plus `size:` on a story is accepted; (b) one that writes `scope:` plus the estimate field on a task is accepted; (c) one that writes `size:` on a task, or a non-Fibonacci `size:`, is refused before commit; (d) the single-file-touched check still refuses a turn that edits any other file.
2. **Executable** — on the branch, `grep -n "size" we:skills-src/conveyor/prepare-scope-agent-brief-v2.md` shows the brief asking for a size on a story and the estimate field on a task (it names neither today).

> **Verified done, 2026-09-22.** Already built and committed straight to `lane/mechanical-dispatcher` at
> `136519577` ("#3842 (Fork 4 \"prepare\" of #3801): the prepare turn now also authors size:/estimatedLoc:"),
> ahead of this card being picked up. Re-verified:
> `we:scripts/operations/__tests__/prepare-scope-wrapper.test.mjs` passes (33 tests) with the
> `#3842 — the size/estimate guardrail` cases present. Resolved here as `graduatedTo: none` — the code is not
> yet on `main`; it reaches `main` through #3443, per this card's own `Home:` section.
