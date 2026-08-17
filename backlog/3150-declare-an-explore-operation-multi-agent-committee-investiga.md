---
bornAs: xedhjen
kind: story
size: 5
status: open
parent: "3029"
relatedTo: ["3037", "3036"]
dateOpened: "2026-08-17"
tags: [operations, epic-3029, committee, research, mcp]
---

# Declare an 'explore' operation: multi-agent committee investigation + optional story-filing

Generalizes the ad hoc N-parallel-investigator-plus-synthesis pattern used live on 2026-08-17 (a 3-reviewer
committee checking an architecture artifact for staleness, a push/observability gap, and MCP treatment,
synthesized by hand into a report) into a declared operation — the fifth under epic #3029, alongside
`review-pr`/`claim`/`dispatch-lane` and the still-open `ratify` (#3033). Today this pattern only exists as one
session's ad hoc judgment: N `Agent()` calls with distinct briefs, synthesized by the orchestrating session,
with no durable run record, no CLI/HTTP/MCP callability, and no observability — not reachable by anyone or
anything outside that one session.

## Shape — no new step kind required

A committee member is NOT a `judge` step (judge is explicitly "one turn, no tools, not an agent loop" — a
committee investigator needs WebFetch/Read/Grep/Bash and multiple turns). It is structurally identical to
`dispatch-lane`'s "agentic work" row — a full spawned agent session — so this operation reuses `dispatch-lane`'s
already-solved long-running-effect machinery (`dispatch: true` / `inFlight(handle)` / the observer contract from
#3073/#3084, plus the liveness-vs-health fix from #3149) rather than inventing new machinery:

```
compute(plan)         — decide panel size + per-panelist lens (fixed default, or itself a `judge` call)
effect(dispatch N)     — spawn N full-agent investigation sessions, dispatch-lane's spawnAgent primitive,
                         one research brief per panelist instead of a build brief
judge(synthesize)      — text-in (the N reports) / findings-out synthesis; no tools needed, fits `judge` cleanly
confirm(optional)      — human gate before filing, only if findings are decision-shaped
effect(file stories)   — parameterized last step: report-only vs. report-and-file, reusing the existing
                         scaffold/backlog effect primitives rather than a second independent operation
```

Story-filing is the operation's *last* effect step, not a separate operation — a separate operation would force
hand-carrying findings between two run records, exactly the seam-friction #3029 exists to eliminate. If
"file stories from any findings" needs to be reusable beyond committee output, that argues for a shared effect
*function* both this operation and others call, not two independent top-level operations.

## Why now

`suggest-next`/leverage scoring aside, this is a natural fifth slice under #3029 — same declare-once-generate-
every-caller thesis, same reuse-don't-reinvent discipline the epic already established with `dispatch-lane`
(#3037, which proved the four-kind vocabulary sufficient for long-running effects) and the pending `ratify`
(#3033, HTTP adapter #3036 also in flight).

## Done when

1. **Executable** — an `explore`/`committee` operation registered in `we:scripts/operations/run.mjs`'s
   OPERATIONS table, with a CLI adapter; a test dispatching a 2-3 panelist committee against a fixture question,
   asserting the synthesis step's findings shape is checked and the run record captures each panelist's
   in-flight/resolved status via the same observer contract `dispatch-lane` uses.
2. Story-filing is exercised as a parameterized effect (report-only run produces no backlog file; report-and-file
   run produces one via the existing scaffold effect), not a hand-rolled second path.
