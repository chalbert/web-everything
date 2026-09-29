---
kind: story
size: 2
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/conveyor/build-dispatch-hold-router.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Standalone worker records WHY it changed nothing onto the card and routes the hold

2026-09-29: Codex (via we:scripts/operations/probation-build-run.mjs) correctly refused #3809 — its target files exist only on the prototype branch lane/mechanical-dispatcher, and porting them exceeds the bugfix envelope — but the runner reported only "not-applicable — the worker changed nothing" and dropped Codex's reason, so the card stays buildable and would be retried. MVP: capture the worker's final message; when it made no change, append it to the card under a Findings note and route the card through the existing hold router (#4465, we:scripts/conveyor/build-dispatch-hold-router.mjs) as out-of-scope/already-done/wrong-target so it is not re-dispatched unchanged. Test: a no-change run with a reason → card gains the note and is held. Proof: replay #3809.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
