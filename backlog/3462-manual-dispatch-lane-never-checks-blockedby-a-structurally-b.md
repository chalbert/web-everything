---
bornAs: xbjuq3i
kind: task
tier: pinned
parent: "3383"
status: active
dateOpened: "2026-09-02"
dateStarted: "2026-09-03"
scope:
  - we:scripts/operations/dispatch-lane.mjs
  - we:scripts/operations/dispatch-lane-io.mjs
  - we:scripts/operations/__tests__/dispatch-lane.test.mjs
relatedTo: ["3457", "3449"]
tags: [conveyor, dispatch, liveness, ground-truth]
---

# Manual dispatch-lane never checks blockedBy — a structurally-blocked item can still be dispatched

`we:scripts/operations/dispatch-lane.mjs`'s manual/CLI `--num=<N>` path has no `blockedBy`/`openBlockers`
awareness at all — confirmed live: it dispatched `#3398` three separate times on 2026-09-02 while
`we:backlog/3398-*.md`'s own frontmatter carried `blockedBy: ["3443"]`, an item that is still `status: open`.
The item's own body explicitly says not to work it before its blocker clears; the manual path dispatched it
anyway, three times, burning real dispatch capacity on structurally-unworkable code.

## The evidence — three real dispatches, not hypothesized

`we:backlog/3398-conveyor-supervisor-runner-residency-has-no-out-of-band-aler.md` frontmatter, read directly:
`status: open`, `blockedBy: ["3443"]`. `we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md`
is itself `status: open` (the branch graduation this item is blocked on is nowhere near done — `#3383`'s own
card puts the branch at 38 commits ahead of `main` as of the most recent count).

Three `dispatch-lane` run records for `#3398`, all in the scratch dispatcher clone's `.operations/runs/`
directory, each `"op": "dispatch-lane"`, `"input": {"num": "3398", ...}`, seconds apart:

| run id | file mtime (2026-09-02) | verdict |
| --- | --- | --- |
| `0d076777-b309-47e8-8c01-d171a7668e70` | 21:06:51 | `dispatching: true`, lane 5, `conveyor-3398b` — "cleared for build on lane 5" |
| `7329295f-d776-4a7d-9aae-bb233b69a981` | 21:06:53 | `dispatching: true`, lane 16, `conveyor-3398` — "cleared for build on lane 16" |
| `d7b4c5f9-2887-46de-b1ef-6f8fd7c29f8c` | 21:06:56 | `dispatching: true`, lane 5, `conveyor-3398c` — "cleared for build on lane 5" |

Every one of the three `read` findings objects carries a fixed, enumerable key set —
`asked, num, launchKind, statusLine, notes, bookkeepingSource, droppedBookkeeping, tickNextState,
dispatchedGuard, expectedWithinMinutes, unreadableRunRecords, dispatchLiveness, dispatching, lane,
sessionSlug, itemSpecPath, pr, prHeadRef, scope, agedOutRuns, briefUnknownTokens, inFlightRuns, holdReason` —
and **`blockedBy`/`openBlockers` is not among them, in any of the three records.** The guard reasons
present (`agedOutDispatches`, `dispatchedGuard`, in-flight duplicate suppression) all concern whether an
identical dispatch is ALREADY running, never whether the item is allowed to run at all.

## Root cause, traced to the exact code — a narrower and more precise finding than "which path is ungated"

`#3457` (the sibling ground-truth decision, ratified the same day) already established that
`we:scripts/readiness/dispatch-plan.mjs` enriches its queue rows with `openBlockers` — true, and it is more
than an enrichment: it is a real, effective gate on the path that reads it.

- **The automatic per-tick sweep path IS correctly gated, by construction — verified live, not assumed.**
  `we:scripts/readiness/dispatch-plan.mjs`'s own docblock (`hasOpenBlockers`, ~line 165) states: "via the
  production build-queue shell this branch is UNREACHABLE — `we:scripts/backlog.mjs build-queue` emits only READY items
  (`isReady` requires every `blockedBy` resolved), so their `openBlockers` is always []." Confirmed directly:
  `node we:scripts/backlog.mjs build-queue --json` (read-only) does **not** list `#3398` at all while its
  blocker is open. The queue that feeds the automatic sweep never contains a blocked item in the first
  place, so `dispatchPlan`'s own `hasOpenBlockers` check is defense-in-depth, not the live gate — the
  filtering already happened one step upstream, in the loader.
- **The gap is entirely in the manual/CLI `we:scripts/operations/dispatch-lane.mjs --num=<N>` path**, which
  is exactly the path the three run records above show being used (`op: dispatch-lane`, a plain `--num=3398`
  input) — not the automatic sweep. This path deliberately does not re-run `we:scripts/readiness/dispatch-plan.mjs`'s read (its own
  docblock: "the tick already decides multiplicity; a loop here would be a second scheduler in front of it" —
  it trusts the caller already made the planning decision) — and nothing enforces that trust.
- **The data is not even computed for this path — not "computed but ignored."**
  `we:scripts/operations/dispatch-lane-io.mjs`'s `defaultLoadItems` (~line 562) calls the exact same canonical
  backlog loader (`we:src/_data/backlog.js`) that `we:scripts/readiness/dispatch-plan.mjs` reads `openBlockers` from — the same
  module's own comment says so ("the SAME one `we:scripts/readiness/dispatch-plan.mjs` enriches its queue rows from"). But
  `findItem` (~line 568-581), the function that turns a loaded record into what `we:scripts/operations/dispatch-lane.mjs`'s guard
  logic (`shapeDispatchRead`) actually sees, narrows the record down to exactly four fields — `num`, `slug`,
  `specPath`, `scope` — and returns nothing else. `blockedBy`/`openBlockers` is discarded at that narrowing
  point, before `we:scripts/operations/dispatch-lane.mjs` ever has a chance to check it. Grepped `we:scripts/operations/dispatch-lane.mjs`
  and `we:scripts/operations/dispatch-lane-io.mjs` for `blockedBy`/`openBlockers` directly — zero matches in
  either file.

So the precise shape, corrected against `#3457`'s own framing: this is **not** "the automatic sweep bypasses
the check" (it doesn't — `#3457`'s own two-chokepoint framing, Ruling 1, is about item-STATUS-vs-merged-PR
checking, a different property, and does not cover `blockedBy` at all) and **not** "the data exists but
nothing gates on it downstream." It is that the manual `we:scripts/operations/dispatch-lane.mjs --num=<N>` entry point — the one a
retry/backoff caller (or an operator) uses to force a specific item through, independent of the ranked
queue — has no `blockedBy` awareness of its own, by design (it trusts an upstream planning step it does not
actually require its caller to have run), and the one place that data is available (the shared loader) drops
the field before the guard layer ever sees it.

## Why this needs its own scoped pass, not a same-session drive-by fix

Fixing this correctly means deciding (a) whether `findItem` should carry `blockedBy`/`openBlockers` through
at all (a small surface widening) and (b) whether `we:scripts/operations/dispatch-lane.mjs`'s guard should hard-refuse a blocked
item unconditionally, or only when the caller has not explicitly overridden it (some manual dispatches are
legitimately used to force a specific item outside the ranked queue, e.g. verified-safe retries) — a real
design call belonging with dispatch/build machinery, per this epic's own "elevated" care-level precedent
(`#3457`'s jury table), not a same-session drive-by fix.

## Done when

1. `we:scripts/operations/dispatch-lane.mjs --num=<N>` refuses (or explicitly, visibly holds) a dispatch for
   an item whose `blockedBy` list has any unresolved entry — mirroring the same "blocked" semantics
   `we:scripts/readiness/dispatch-plan.mjs`'s `hasOpenBlockers` already encodes for the automatic path, so
   the two paths agree on the same invariant instead of only one enforcing it.
2. **A real regression test** proves the fix: dispatch a fabricated item whose loader record carries a
   non-empty `blockedBy`/`openBlockers`, with no in-flight guard and a free lane — the dispatch is refused
   (or held) with a reason string naming the open blocker(s). The test must fail against the pre-fix code
   (not merely restate existing `we:scripts/operations/__tests__/dispatch-lane.test.mjs` coverage, which has
   no such case today — grepped, zero matches).
3. A decision is recorded (in this item, or a follow-on it names) for the override question in "Why this
   needs its own scoped pass" above — whether a manual dispatch may ever force a blocked item through
   deliberately, and if so, what that override looks like (an explicit flag, never a silent default).
4. No duplication with `#3457`. `#3457` is about an item's `status:` lagging real completion (a merged PR the
   card doesn't know about yet) — a data-freshness problem. This item is about `blockedBy` — a structural
   readiness problem — never being read at all on the manual dispatch path. Same family (trust real ground
   truth over stale/absent bookkeeping, the same shape `#3449` names for lane leases), different resource;
   fixing one does not fix the other.

## Progress

**The override question (done-when #3) is decided: no override, ever — a hard, unconditional refusal.**

`we:scripts/operations/dispatch-lane.mjs`'s `shapeDispatchRead` now refuses any dispatch (build, prepare,
prepare-decision, fix or ci-heal alike) for an item whose `openBlockers` is non-empty, with no flag, env var
or bookkeeping key that can force it through. The refusal is checked at the same priority tier as the
`#3457`/`#3460` already-done ground-truth check — before the tick core's own `launch` decision is even
consulted — because the live incident this item documents is exactly the core clearing a blocked item for
`spawnBuilds` anyway; trusting the core's decision on this axis is the bug, not the fix.

Reasoning for "no override" over "an explicit force flag": the manual `--num=<N>` path exists for a
retry/backoff caller or an operator to force a SPECIFIC item through outside the ranked queue — but forcing a
STRUCTURALLY blocked item (one whose prerequisite work is not done) is never a legitimate use of that
override, unlike e.g. re-attempting an item the automatic sweep is merely rate-limiting. No real dispatch
recorded to date has ever needed to bypass an open `blockedBy` edge on purpose (the #3398 incident this item
documents was three UNWANTED dispatches, not a deliberate override), and adding a bypass flag before a real
need for one is observed is exactly the kind of speculative surface `we:docs/agent/platform-decisions.md`
warns against. If a real, legitimate need to force a blocked item through ever surfaces, it should be filed
as its own scoped follow-on (it would need its own audit trail — who forced it and why — which is a bigger
design question than this item's scope), not bolted on here as an untested escape hatch.

`we:scripts/operations/dispatch-lane-io.mjs`'s `findItem` now threads `openBlockers` through from the
canonical backlog loader (`we:src/_data/backlog.js`) — the same field `we:scripts/readiness/dispatch-plan.mjs`
already reads for the automatic sweep's `hasOpenBlockers` hold — instead of narrowing it away. Regression
coverage in `we:scripts/operations/__tests__/dispatch-lane.test.mjs` reproduces the #3398 shape (a fabricated
item with `openBlockers: ['3443']`, no in-flight guard, a free lane, the core having cleared it anyway) and
was confirmed to fail against the pre-fix source.
