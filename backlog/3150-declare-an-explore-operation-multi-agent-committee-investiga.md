---
bornAs: xedhjen
kind: story
size: 5
status: resolved
parent: "3029"
relatedTo: ["3037", "3036"]
scope: ["we:scripts/operations/run.mjs", "we:scripts/operations/explore.mjs", "we:scripts/operations/explore-io.mjs"]
dateOpened: "2026-08-17"
dateStarted: "2026-08-17"
dateResolved: "2026-08-17"
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

**A second mode, not a second operation (2026-08-17):** a prior-art/precedent research survey — the step
`prepare-decision-item` already does by hand for every decision it preps — is this same shape at panel size 1:
one investigator, a `research` lens instead of an `architecture-audit` lens, and a different last effect
(publish a `/research/` topic, the existing pattern already used throughout `we:docs/agent/backlog-workflow.md`)
instead of filing a story. The `plan` step's "per-panelist lens" should be designed as a genuinely open set from
the start (architecture-audit, prior-art-survey, whatever a future caller needs), not hardcoded to the one lens
this item's own motivating example used — and the "file stories" last effect should be one of several
pluggable terminal effects (publish-research-topic is another), not the only one.

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

## Progress

**Delivered 2026-08-17.** `explore` is declared in `we:scripts/operations/explore.mjs` (pure — its whole static
import graph is `registry` + `step-kinds` + the fence leaf, asserted) with its io shell in
`we:scripts/operations/explore-io.mjs`, registered in `we:scripts/operations/run.mjs`'s OPERATIONS table, and its
observer bound by the waker's CLI beside `dispatch-lane`'s. The command line is derived, not written:

```
$ node scripts/operations/run.mjs explore --help
usage: run.mjs explore --question=<string> [--panel=<number>, default 3] [--lenses=<string>, default ]
       [--terminal=report-only|file-stories|publish-research, default report-only] [--parent=<string>, default ]
       [--scope=<string>, default ] [--expectedWithinMinutes=<number>, default 45] [--json]
steps: plan(compute) → investigate(effect) → synthesize(judge) → reduce(compute) → confirm(confirm) → file(effect)
```

**No fifth step kind, and no new mechanism** — the card's prediction held. A panelist is a `dispatch: true`
effect over #3073's `inFlight(handle)` and #3084's observer contract, exactly as a delivery agent is; the
synthesis is a tool-free `judge`; the terminal effect is one `describe()` call into a pluggable table.

**Where it went beyond the sketch, and why:**

- **The completion signal is the panelist's own report, ending in a marker.** `dispatch-lane`'s observer could
  never answer `succeeded` from liveness alone (`claude agents` reports whether a session exists, never how it
  ended). An investigation has a better signal available, so the observer reads the report file FIRST and uses
  three of the four observation words honestly: marker present → `succeeded`; non-empty report with the session
  gone → `resolved` (#3085 — a known outcome it does not call clean, so one dead panelist cannot park the whole
  committee); nothing → `unresolved`. The marker is what stops a saved draft from being synthesized as final.
- **Reports live at `<workspace>/.operations/explore/`, outside every checkout.** This is a guard question, not
  a taste one: `we:scripts/guard-lane.mjs` denies a write inside a primary checkout AND (since #2997) inside a
  lane clone whose live lease names a different session — and a panelist is by construction a different session
  from whoever started it. A report under `<checkout>/.operations/` would therefore be blocked in both places an
  `explore` run realistically executes. `workspaceRootOf` is imported from the guard rather than re-derived, so
  the region written into and the region allowed are one definition.
- **The `confirm` step is declared unconditionally.** The card sketched it as optional ("only if findings are
  decision-shaped"), and the closed vocabulary has no conditional step — one that sometimes suspends is a fifth
  kind wearing a hat. What varies is what it ASKS; `abstain` is always the zero-effect exit, exactly as in
  `review-pr`. On a `report-only` run the question says plainly that both answers write nothing.
- **The lens set is genuinely open** (`--lenses=` takes any well-formed slug, asserted with a lens no roster
  names), while the TERMINAL MODE set is a declared `enum` — because each mode is an effect type with a sink
  behind it, and a mode nothing can apply is a run that dies at its last step.
- **The filing gate lives in `reduce`, not in the sink.** A juror's `suggestedItem` on a `confirmation` or
  `contradiction` finding, or one sized off the repo's ladder, is refused WITH ITS REASON on the verdict — a
  silently dropped suggestion is indistinguishable from a juror that proposed nothing.

**One real cost, stated rather than worked around.** `applyPendingEffects` halts at the first effect whose sink
returns an in-flight marker, so the shipped executor starts panelist 2 only after panelist 1 resolves: a
three-panelist committee investigates SERIALLY. Every alternative reachable from a declaration is worse (one
handle for N sessions makes N-1 unobservable; an ordinary return records `applied` for unfinished work).
Parallel fan-out is a property of the EXECUTOR, so it is filed as #x6km5wp rather than smuggled in behind a
committee — and the test *"the executor applies the seats ONE AT A TIME"* is the tripwire that fails when it
lands. Panelist blindness is unaffected: no panelist ever reads another's report.

**Two adversarial review rounds, and they earned their keep.** Round 1 returned two blockers, both real and
both fixed:

- **A panelist could author the whole committee.** The report path was keyed on `(runId, seat)` alone, and the
  executor serializes the seats — so p1 ran to completion before p2 was dispatched, with p2's path one token's
  substitution from its own. Pre-writing it forged the cross-lens agreement the synthesis leans hardest on, and
  on a filing run forged agreement becomes real backlog items. The path now carries the attempt's MINTED session
  id, which also fixes a retried seat inheriting its predecessor's finished report.
- **`publishResearchTopic` wrote tracked `src/…` files with a bare `writeFileSync`,** so a publish from the
  primary checkout landed there — the exact write `laneGuardDecision` denies, and never got the chance to,
  because an effect sink writing to `fs` is invisible to the PreToolUse hooks. It now passes three gates before
  either write: the lane guard, the #3015 secret scrub and the #883 locus-prefix scan (the latter two extracted
  out of `we:scripts/backlog/guarded-write.mjs` so both writers share ONE chain), then the overwrite guard.

Also from round 1: `idempotent: true` on the research effect was false across a date boundary (a half-written
topic could never be finished — the dates are inherited now); a pre-spawn failure recorded an unobservable
`in-flight` entry that wedged the run (`notApplied` now); and juror prose naming a bare code path either wedged
a filing or reddened the next lander's gate (the prefix rule is now in both the brief and the mandate, and
gated at write time).

Round 2 confirmed both blockers closed by driving the code, and found that the fix's docblock over-claimed: it
said a sibling's report path was now underivable, and two channels remain — the run store sits inside the
panelist's own cwd, and a reported panelist keeps running long enough to set-difference the agent listing. A
false security claim is worse than a documented residual, so the note now says what it does and does not close,
the brief forbids writing anywhere but the one path given, and the structural close is filed as #xvpy20j.

**Proof.** `we:scripts/operations/__tests__/explore.test.mjs` — 51 tests, no `claude`, no `gh`, no filesystem.
The acceptance block drives a THREE-panelist committee from `startRun` to `complete` and asserts each seat's
`in-flight` → `applied` transition with its own distinct handle and `expectedBy`; the parameterized-terminal
block runs the SAME harness twice, differing only in `--terminal`, and asserts the report-only run writes
nothing while the file-stories run calls the real `we:scripts/backlog.mjs scaffold --json` once.
`we:scripts/backlog/__tests__/primary-write-guard.test.mjs` gained four assertions pinning the extracted
content gates on the card writer — before this they were one deletable line no test would have missed.
`npx vitest run scripts/operations/ scripts/backlog/` is 884 green.

**Leftovers filed rather than half-done:** #x6km5wp (parallel dispatch fan-out in the executor), #xvpy20j (the
residual blindness channels), #x7w2z4u (nothing reclaims the panelist scratch directory).
