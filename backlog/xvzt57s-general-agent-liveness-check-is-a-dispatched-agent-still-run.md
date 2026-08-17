---
kind: task
status: open
relatedTo: ["3149"]
tier: pinned
dateOpened: "2026-08-17"
tags: [operations, orchestration-load, observability]
---

# General agent-liveness check: is a dispatched agent still running, stalled, or finished

There is no way to ask "is agent X still alive, stalled, or already finished" without either waiting for its
completion notification or spawning a new agent to go check — and the second option is actively dangerous:
it's exactly what caused a duplicate-review near-miss on `we#1429` on 2026-08-17 (a redundant "restart the
stalled reviewer" dispatch went out because there was no cheap way to confirm the original reviewer had
already completed with a real verdict; the redundant reviewer then applied `review:accepted` while the real
findings from the first reviewer were still unfixed, and the PR briefly reached `ready-to-merge` before it
was caught).

## Relationship to #3149

Same underlying shape as `#3149` (surface stuck background-agent permission prompts) — both read
`claude agents --json`'s `status`/`waitingFor`/`state` fields — but `#3149` is scoped specifically to
permission-prompt-blocked *conveyor* sessions. This item is the general case: any dispatched agent
(background or foreground-async), any reason it might be stalled or finished, queryable on demand by the
orchestrating session before deciding whether to wait, nudge, or redispatch.

## Done when

1. **Executable** — a query given an agent/task id reports one of `running`/`stalled`/`finished`/`unknown`,
   sourced from the same `claude agents --json` data `#3149` already reads; a test with a fixture session in
   each state asserts the correct classification.
