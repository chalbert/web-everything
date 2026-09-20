---
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/gen-decision-docket.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Decision docket has not been rebuilt since 2026-09-14

FOUND 2026-09-20. The wip report prints 70 open decisions in the docket, built 2026-09-14 14:32 EDT, docket may be stale: nothing rebuilds it. The generator is we:scripts/gen-decision-docket.mjs and the decision-docket skill publishes it. DESIGN TO SETTLE: a rebuild trigger (on decision filed or resolved, or daily) and where its age is shown. ACCEPTANCE: the docket age never exceeds a stated bound while decisions change.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
