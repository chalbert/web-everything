---
bornAs: x1losg9
kind: story
size: 2
status: resolved
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/conveyor/build-dispatch-hold-router.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
tags: []
---

# Standalone worker records WHY it changed nothing onto the card and routes the hold

2026-09-29: Codex (via we:scripts/operations/probation-build-run.mjs) correctly refused #3809 — its target files exist only on the prototype branch lane/mechanical-dispatcher, and porting them exceeds the bugfix envelope — but the runner reported only "not-applicable — the worker changed nothing" and dropped Codex's reason, so the card stays buildable and would be retried. MVP: capture the worker's final message; when it made no change, append it to the card under a Findings note and route the card through the existing hold router (#4465, we:scripts/conveyor/build-dispatch-hold-router.mjs) as out-of-scope/already-done/wrong-target so it is not re-dispatched unchanged. Test: a no-change run with a reason → card gains the note and is held. Proof: replay #3809.

## Done when

1. **Executable** — `npx vitest related $(git diff --name-only) --run` covers the no-change finding, hold and card-only landing.

## Prep

Capture the standalone launcher report before truncating output (Codex `lastMessage`, Gemini `events.finalResponse`). Route no-change runs as `worker-declined` through the existing hold router, remove scope and append a quoted Findings note, then reuse the runner’s verified, parked `review:pending` PR path without resolving the item. Missing messages get a generic reason. Scope must be authored again before another build. Cover reason capture, fallback, hold routing, card persistence and failure handling with related Vitest tests.
