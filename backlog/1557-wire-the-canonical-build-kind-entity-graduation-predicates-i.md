---
kind: story
size: 3
status: resolved
blockedBy: ["1473"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# Wire the canonical build-kind + entity-graduation predicates into `we:scripts/audit-backlog-health.mjs` (G2/G3 still inert)

The backlog-health audit consumes NEITHER canonical helper: the exec gate hardcodes the removed idea|issue kinds (`we:scripts/audit-backlog-health.mjs:334`) so G2/G3 never fire, and the G3 subject predicate (`:366`) does NOT call `isEntityGraduation` despite resolved #1498's "shipped this turn" list claiming that wiring landed. Both helpers exist and are tested (`we:scripts/check-standards-rules.mjs:34` `isExecKind`, `:43` `isEntityGraduation`; `we:scripts/__tests__/exec-kind.test.mjs`) but are imported nowhere. Wire both per #1473's ratified exec form (import `isExecKind`, include epic) and #1498's ratified subject scope (entity-graduation), update the G2/G3 doc comments + summary desc, and verify they actually fire (G3 ~41). Blocked on #1473.

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559) — superseded by #1473

This item's entire scope had **already landed** when its blocker, #1473, resolved (commit
`e0a73d0` — "wire canonical build-kind exec gate into G2/G3"). #1557 was authored from a pre-#1473 view of
the file; the premise (gates inert, helpers imported nowhere) is now false. Verified the real state:

- **Import present** — `we:scripts/audit-backlog-health.mjs:73` imports `{ isExecKind, isEntityGraduation }`
  from `we:scripts/check-standards-rules.mjs`.
- **Exec gate wired** — `we:scripts/audit-backlog-health.mjs:336` `const isExec = isExecKind(it.type)` drives
  G2 (`:357`) and G3 (`:368`); the hardcoded `idea|issue` set is gone.
- **G3 subject wired** — `we:scripts/audit-backlog-health.mjs:368` gates on `isEntityGraduation(it.fm.graduatedTo)`.
- **Doc comments + summary desc current** — the G2/G3 header block (`:17`, `:24` "non-decision kind", `:25`
  "isEntityGraduation, #1498") and the summary `desc` (`:490`) carry the post-#1473 language; no stale
  idea|issue text remains.
- **They fire** — `npm run check:health` reports **G2=2, G3=41** (the expected ~41);
  `we:scripts/__tests__/exec-kind.test.mjs` passes (8 tests).

No code change needed — closing as superseded (a duplicate of #1473's delivered scope). `graduatedTo: none`
(verification task, no new entity).
