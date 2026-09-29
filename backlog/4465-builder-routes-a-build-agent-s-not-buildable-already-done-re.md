---
bornAs: xs7cyyh
kind: story
size: 3
tier: pinned
status: resolved
scope: ["we:scripts/conveyor/build-dispatch-hold-router.mjs", "we:scripts/operations/build-dispatch-hold-route-land.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "6c52bbe01840f6aa4d4d1278265724d3e8f7d73a"
tags: []
---

# Builder routes a build agent's 'not buildable' / 'already done' report automatically instead of holding it forever

Live 2026-09-29: build agents correctly declined three items and the build daemon put each into build-dispatch-holds, where they sit with no owner: #4295 ('spec not buildable as written within declared scope: the enforcement call sites are all outside scope'), #4380 ('spec already done on main: commit b93d13e29 … card just needs resolving'), #4108 ('spec superseded … re-scope or close'). Nothing acts on the hold, so the card never gets fixed or resolved and only an operator noticing moves it. MVP in the build daemon's hold path (we:skills-src/conveyor/build-dispatch-daemon.mjs and the delivery wrapper's outcome classification, we:scripts/operations/deliver-item-wrapper.mjs): classify the agent's report into (a) already-done → run the sanctioned resolve with graduatedTo = the cited commit, landed via a lane PR; (b) out-of-scope / spec-wrong → send the card to prepare (re-scope) with the agent's finding attached, and release the hold once re-prepared; (c) anything else → open a health finding naming the item and reason. Must: tests for the three routes; soak break (held item never moves → routed) RED before / GREEN after; live proof: #4380 resolves itself and #4295 goes to prepare with its finding.

## Conveyor delivery-agent brief prep (2026-09-29)

**Premise check** — not already done, not superseded. `git log origin/main` has only the filing PR
(#2920, then JIT-numbered #4465 at the #2288 land commit) — no code anywhere classifies or acts on a hold's
`reason`; `listBuildDispatchHolds` (we:scripts/conveyor/build-dispatch-claim.mjs) is read only to EXCLUDE held
items from a tick's dispatch candidates. Buildable as written.

**preparedDate/preparedAgainstSha set by hand, status kept `active`** — `node we:scripts/backlog.mjs
prepare-stamp` forces `status: open` unconditionally (already a known, filed gap on an actively-claimed card,
we:backlog/4480-prepare-stamp-works-on-an-actively-claimed-card-without-rese.md, hit by two other workers
today), which would undo this lane's own claim mid-build. Per the operator's own correction, stamped
`preparedDate`/`preparedAgainstSha` directly in the frontmatter instead, keeping `status: active`.

## Design

The daemon already reads every live hold each tick (`listBuildDispatchHolds`) but only to EXCLUDE the held
item from dispatch — never to act on *why* it is held. Close that gap with a pure classifier over the hold's
own `reason` text, plus a thin IO-shell orchestrator the daemon's live tick calls, best-effort, the same
posture its existing `adoptOrphans`/`retryInfraBlocked` effects already have:
- we:scripts/conveyor/build-dispatch-hold-router.mjs (NEW) — pure `classifyHoldReason`/`planHoldRouting`,
  plus the small IO-shell `routeHeldItems` orchestrator (a per-item dedup lease that gates EVERY route, then
  spawn-detached-landing for (a)/(b) or append-finding for (c)), all effects injected. **Never releases the
  build-dispatch hold, and never releases its own dedup lease either — both self-expire on their own TTL**
  (added in review round 2: releasing either early would let the very next tick re-dispatch a build agent, or
  route (c) re-crash-loop, before the fix is actually merged/re-scoped — see `routeHeldItems`'s own docblock).
- we:scripts/operations/build-dispatch-hold-route-land.mjs (NEW) — the LANE-BOUND landing pass for routes
  (a)/(b), same shape as we:scripts/operations/health-file-request-land.mjs (acquire lane → mechanical edit →
  commit → push → verify → `open-pr --mode=label-on-green` → release lane), stable ref `lane/hold-route-<num>`
  for same-ref idempotency.
- we:skills-src/conveyor/build-dispatch-daemon.mjs — wire `planHoldRouting` into the tick's report (both
  `--dry-run` and `--live`) and `routeHeldItems` as a LIVE-only, best-effort effect (same posture as
  `adoptOrphans`/`retryInfraBlocked`).

**Dropped from original scope:** we:scripts/operations/deliver-item-wrapper.mjs. The card's free-text body
guessed the wrapper's own `placeBuildDispatchHold` call site as where classification would live, but
`listBuildDispatchHolds()` already sees EVERY hold in the shared coordination root regardless of which
process placed it (past or future), so a tick-based sweep in the daemon achieves the full spec — including
today's 3 already-held live cases — with no change needed to a 2497-line, six-firm-requirements, live-critical
wrapper. Not touching it is the safer, smaller diff (small-file / risk discipline), not a scope gap.

**Route (c) "open a health finding"** — the existing health-finding machinery
(we:scripts/conveyor/health-file-request.mjs) is coupled to the health daemon's own smell/episode model
(keyed by `(smell, subject)` from ITS tick), not a good fit for an ad-hoc reason string from an unrelated
daemon. MVP writes a small durable JSON ledger (`we:build-dispatch-hold-findings.json` under the coordination
root) instead; wiring it into the full episode/smell pipeline is left as a follow-on (scaffolded below) rather
than widening this item's scope.

## MVP

Musts only, everything else is a Follow-up:
1. `classifyHoldReason(reason)` — pure, three routes: `already-done` (extracts the cited commit),
   `out-of-scope` (not-buildable/superseded), `other` (anything else, e.g. a crash reason).
2. `planHoldRouting(holds)` — pure, maps every live hold to a routing entry.
3. `routeHeldItems(...)` — IO-shell, every effect injected: EVERY route dedups a per-item lease first (never
   released — self-expires on its own TTL), then (a)/(b) spawn the DETACHED landing pass (never inline in the
   daemon's own tick — a lane-acquire→PR arc is minutes); (c) append one durable finding to a small JSON
   ledger. The build-dispatch hold itself is never released by any route — it is left to self-expire.
4. we:scripts/operations/build-dispatch-hold-route-land.mjs — the actual landing: (a) `we:scripts/backlog.mjs
   resolve --graduated-to=<sha>`; (b) clear `scope:` (→ existing unshaped-item auto-prepare picks it up) +
   append the finding to the card body. Both land through one small PR, `--mode=label-on-green`.
5. Daemon wiring: `holdRouting` visible on every tick (dry-run included); `routeHeldItems` called LIVE-only,
   best-effort, never blocking the tick.

Explicitly OUT of the MVP (see Follow-ups): wiring route (c) into the full health-episode/smell pipeline;
classifying at the delivery wrapper's own `placeBuildDispatchHold` call site (immediate, same-tick routing —
the MVP's sweep already reaches every hold, just on the NEXT tick rather than instantly).

## Test plan

Each of these fails before this item's code exists (no such module/wiring) and passes after:
- we:scripts/conveyor/__tests__/build-dispatch-hold-router.test.mjs — `classifyHoldReason`/`planHoldRouting`
  pure-core coverage for all three routes (already-done w/ extracted sha, out-of-scope, other), plus
  `reserveHoldRoute`/`releaseHoldRoute`/`appendHoldFinding`/`listHoldFindings`/`routeHeldItems`.
- we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs — `landOne`/`landRoute` for both
  landable routes, with every subprocess call injected (asserts the lane path is used, never `REPO_ROOT`).
- we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs — the wiring: `holdRouting` on both a
  dry-run and a live tick, `routeHeldItems` called LIVE-only exactly once, best-effort on a throw, a no-op for
  an older effects stub.
- we:scripts/conveyor/soak/breaks/build-dispatch-hold-never-routed.mjs (+ its own soak test) — the soak
  break: RED before this fix (a held item never gets routed across 3 real ticks), GREEN after.

Added by convergence review round 2 (real bugs the panel caught, fixed before opening the PR — see the
`git log`-free evidence in the delivery report, since none of this landed as separate commits):
- a regression test that two `reserveHoldRoute` calls with the DEFAULT owner (the production shape — a
  long-lived resident daemon calling from one constant `hostname:pid`) still dedup correctly (second call
  refused, not treated as a same-owner reentrant renewal — the exact bug that would have let every tick spawn
  an overlapping landing attempt for the hold's whole TTL).
- route 'other' dedup: a second `routeHeldItems` call for the same still-leased item records no second
  finding (an earlier revision had NO dedup on this route at all).
- `commitReferencesItem`/`extractBornAs` — the already-done route now also requires the cited commit's own
  message to name this card (by numeric id OR its `bornAs` hash, since a commit that landed before this card
  was JIT-numbered names the hash instead), not merely that it is SOME real ancestor of `origin/main`.

Added by convergence review round 3 (a second full panel run over the revised diff, still real bugs):
- `DEFAULT_ROUTE_LEASE_MINUTES` is now DERIVED from `DEFAULT_BUILD_DISPATCH_HOLD_MINUTES + 10` (never two
  independently hand-tuned literals that can drift) — a shorter lease used to expire while the hold was still
  live, letting a later tick re-route (and for out-of-scope, re-clear the scope + re-append a finding on) a
  card that may already have merged and been re-prepared in between.
- `commitTouchesNonBacklogFile` — the already-done route also requires the cited commit to touch at least
  one file OUTSIDE `backlog/`, since naming the card alone is satisfied by a purely mechanical
  filing/resolve/JIT-numbering commit that never implements the spec.
- `escapeRegExp` — `commitReferencesItem` regex-escapes every id before building a `RegExp` from it, since
  `bornAs` is untrusted, card-file-supplied text (an unescaped metacharacter-laden id could match almost any
  message, or throw).
- `routeHeldItems` now releases its own dedup lease on a DEFINITE failure — `spawnLand`/`recordFinding`
  throwing or rejecting before the detached process (or the ledger write) even started — so the very next
  tick retries promptly instead of waiting out the full lease TTL for an attempt that never ran at all. A
  landing that starts but fails LATER, inside the detached process, has no feedback channel back to this
  daemon at all and is NOT retried by this fix — see the new follow-up card above.
- corrected `landRoute`'s own docblock and this card's Design/MVP sections, which had drifted to claim a
  "later retry" guarantee round 2's fix had already made false.

## Proof plan

Live, read-only (no mutation — never running the daemon `--live` against real coordination state during this
build), from this lane, against the REAL `~/workspace/.operations/coordination/build-dispatch-holds/` on this
host (path cited as we:skills-src/conveyor/build-dispatch-daemon.mjs — copy-paste executable as written, no
`<repo>:` marker inside the fenced command itself, per the `we:AGENTS.md` locus-prefix convention's own
fenced-code carve-out):

```sh
node skills-src/conveyor/build-dispatch-daemon.mjs --dry-run --json
```

reports:
- #4295 → `out-of-scope` (spec not buildable as written).
- #4380 → `already-done`, commit `b93d13e29`.
- #4108 → its hold had aged past the PRE-EXISTING 240-minute hold TTL by the time this ran (unrelated to this
  fix), so it no longer appears in `listBuildDispatchHolds()`'s output, and therefore cannot appear in the
  dry-run's own `holdRouting` array either — `classifyHoldReason` called directly on its recorded reason text
  (preserved above, from the live incident) still confirms `out-of-scope`, same as #4295. Done-when #4 below
  is worded to match: it asserts the dry-run's live output for #4295/#4380 only, and #4108 via the direct
  `classifyHoldReason` call.

Soak: the break module's own `run`+`judge` run once with the fix's own files `git stash`ed away (RED — judge
reports the hold was never routed) and once restored (GREEN — `judge` returns `[]`).

## Follow-ups (filed as cards, not built here)

- we:backlog/4523-route-c-build-dispatch-hold-findings-feed-the-health-episode.md — wire route (c) findings
  into the full health-episode/smell pipeline instead of the standalone JSON ledger.
- we:backlog/4521-classify-a-build-dispatch-hold-at-placement-time-deliver-ite.md — classify at the delivery
  wrapper's own `placeBuildDispatchHold` call site for same-tick (not next-tick) routing.
- we:backlog/4522-observe-a-hold-route-landing-s-own-terminal-outcome-instead.md — give a hold-route
  landing the same run-store/settle observability the `build` dispatch path already has, instead of a
  fire-and-forget detached spawn; a landing that starts but later fails is currently a known, accepted MVP
  gap (rides out the lease/hold TTL rather than being retried promptly).
- we:backlog/4480-prepare-stamp-works-on-an-actively-claimed-card-without-rese.md already tracks the
  `prepare-stamp` reset-to-open gap this prep hit by hand — not re-filed, just cross-referenced.

## Done when

1. **Executable** — fails before this item lands (no such router/land module exist) and passes after (paths
   cited as we:scripts/conveyor/__tests__/build-dispatch-hold-router.test.mjs,
   we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs,
   we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs):
   ```sh
   npx vitest run scripts/conveyor/__tests__/build-dispatch-hold-router.test.mjs \
     scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs \
     skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs
   ```
2. **Three routes classified + tested** — `classifyHoldReason` has a passing unit test for each of the three
   live reason shapes: already-done (extracts the cited commit sha), out-of-scope/superseded, and an
   unrecognized/other reason (e.g. `wrapper-threw`).
3. **Soak break RED→GREEN** — we:scripts/conveyor/soak/breaks/build-dispatch-hold-never-routed.mjs (+ its
   we:scripts/conveyor/soak/breaks/build-dispatch-hold-never-routed.soak.test.mjs) reproduces "a held item
   sits forever, never routed" against the pre-fix daemon and is fixed post-fix.
4. **Live proof, read-only** — run from this lane against the real coordination root (path cited as
   we:skills-src/conveyor/build-dispatch-daemon.mjs):
   ```sh
   node skills-src/conveyor/build-dispatch-daemon.mjs --dry-run --json
   ```
   reports the correct route for the two live holds still within their TTL at run time (#4295 →
   out-of-scope, #4380 → already-done with commit `b93d13e29`) without mutating anything (dry-run touches
   nothing, per the daemon's own existing contract). #4108's hold aged out before this ran (see the Proof
   plan) — that item is instead confirmed by calling `classifyHoldReason` directly on its recorded reason
   text, not by the live dry-run output.
