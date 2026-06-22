---
kind: story
size: 3
status: open
blockedBy: ["1473"]
dateOpened: "2026-06-22"
tags: []
---

# Wire the canonical build-kind + entity-graduation predicates into `we:scripts/audit-backlog-health.mjs` (G2/G3 still inert)

The backlog-health audit consumes NEITHER canonical helper: the exec gate hardcodes the removed idea|issue kinds (`we:scripts/audit-backlog-health.mjs:334`) so G2/G3 never fire, and the G3 subject predicate (`:366`) does NOT call `isEntityGraduation` despite resolved #1498's "shipped this turn" list claiming that wiring landed. Both helpers exist and are tested (`we:scripts/check-standards-rules.mjs:34` `isExecKind`, `:43` `isEntityGraduation`; `we:scripts/__tests__/exec-kind.test.mjs`) but are imported nowhere. Wire both per #1473's ratified exec form (import `isExecKind`, include epic) and #1498's ratified subject scope (entity-graduation), update the G2/G3 doc comments + summary desc, and verify they actually fire (G3 ~41). Blocked on #1473.
