---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/stand-down.mjs", "we:scripts/conveyor/fix-dispatch-claim.mjs", "we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/__tests__/fix-procedure.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# A fixer that stands down releases its dispatch claim at once, so the next repair or split can start

Live case 2026-10-01 PR #3311: fix-3311 stood down (needs-judgment) at ~19:55 UTC, but the daemon fix-dispatch claim it ran under stayed live until its 10-minute TTL ran out, so the operator-approved split job could not take the fix lock (fixBegin refuses dispatched-fixer via liveForeignDispatch in we:scripts/conveyor/fix-procedure.mjs). The refusal reason was also invisible: the CLI prints it only as JSON on stdout. Fix: stand-down (we:scripts/conveyor/stand-down.mjs) releases the session fix-dispatch claim (we:scripts/conveyor/fix-dispatch-claim.mjs) when it posts its marker; fix-begin prints the refusal reason and holder on stderr. Test: stand-down then fix-begin by another who succeeds immediately; replay the #3311 timeline.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
