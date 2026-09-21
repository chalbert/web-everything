---
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-21"
tags: []
---

# Add the blockedBy gate edge #3717 → #3801 so the /wip NEXT list stops offering #3717

Decision #3801 gates the choices in #3717, but #3717 has no `blockedBy` entry for it, so the mechanical NEXT list in the /wip report (ruled in #3819 Fork 5) would offer #3717 as dispatchable. Add `blockedBy: ["3801"]` to #3717 and check that nothing else was named as a gate only in prose. The other two edges #3819 named are moot: #3653 and #3804 are resolved, and #3486 already has blockedBy #3482 and #3483.

## Done when

1. **Executable** — `grep -E '^blockedBy:.*"3801"' we:backlog/3717-*.md` prints a line (it prints nothing before this item lands), and `npm run check:standards` stays green.
