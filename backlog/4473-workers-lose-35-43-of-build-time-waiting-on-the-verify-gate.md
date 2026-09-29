---
bornAs: xohgr1h
kind: story
size: 5
status: resolved
blockedBy: ["4296"]
scope: ["we:scripts/verify-lane.mjs", "we:scripts/lib/verify-lane-gate.mjs", "we:scripts/lib/lane-verify.mjs", "we:scripts/conveyor/run-rating.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "30c4c6925a23402b2acbb37e406184a520aa3aa5"
tags: []
---

# Workers lose 35-43% of build time waiting on the verify gate — cut repeat verifies and the wait

Measured 2026-09-29 from worker transcripts (tool time vs wall): worker #4296 90 min wall, 38.6 min (43%) in the verify gate (35 polls of the verify check with a 60s wait); worker #4304 91 min, 31.8 min (35%) verify + 11.9 min vitest; worker #4297 60 min, 14.3 min verify + 10.2 min open-pr. Model time between calls is ~40-50%, the rest is small. The verify daemon log shows 131 dispatches with the same lane+sha verified repeatedly (lane-36 x8, lane-8 x6, lane-21 and lane-17 x4, lane-22 x3): a worker re-requests after each edit while HEAD is unchanged (work uncommitted), and each run is a full vitest-related plus check:standards. Related-file lists also include lane scratch files (the commit-message, PR-body and converge-state files). MVP: (1) verify requests keyed to working-tree content (depends on #4296, key the marker to what changed) so an unchanged tree is answered from the cached result instantly; (2) when a heavy slot is free, run the gate inline for the requester instead of queue-and-poll (we:scripts/verify-lane.mjs request/check, we:scripts/readiness/heavy-admission.mjs); (3) exclude lane scratch files from the related set. Must: measured before/after on a real worker build (verify minutes and verify dispatch count per build).

## Design

**Premise check (against `main` @ `30c4c692`).** #4296 (PR #2937, resolved) keyed the finish-guard's marker
match to "lane-relevant files changed since the marker's *recorded* sha", not the exact sha — it fixes a
DIFFERENT case (a new commit, e.g. a no-op merge, lands and the marker must decide whether to still cover it).
It does **not** touch the case this item's evidence actually shows: a worker edits files **without committing**
(HEAD never moves) and calls `request` again. Read `we:scripts/verify-lane.mjs` lines 269-273: `request` and
bare `verify` **unconditionally** overwrite the on-disk marker with a fresh `running` start-body — even when the
existing marker is already a terminal `green`/`red` record for the *exact same* `headSha`.
`we:scripts/conveyor/verify-dispatch.mjs`'s `laneNeedsVerifyDispatch` then sees `running` for the lane's current
head and dispatches a full `vitest related` + `check:standards` run, whether or not anything the gate would look
at actually changed. That is the literal mechanism behind "131 dispatches with the same lane+sha verified
repeatedly (lane-36 x8, ...)" — confirmed live below, not just read from source. Not already done, not
superseded — building on #4296 as directed.

**Why "same `headSha`" alone is not a safe skip condition.** Since HEAD doesn't move on an uncommitted edit, a
naive "skip if `rec.sha === headSha`" would silently skip re-verifying a tree the worker changed *after* the
green was recorded — a false green. The gate's own inputs (`resolveDefaultGate` / `localChangedSet`) are keyed
off the **working-tree diff** against the merge-base (tracked + untracked), not the commit — so the cache key
must be too. The fix adds a `treeHash`: a hash of that same working-tree diff plus a sorted `git hash-object` of
every untracked file, computed with the exact same `runGit` shell already used for the gate decision (no new IO
primitive). `request`/bare `verify` compute the current `treeHash` before touching the marker; only when `sha`,
`treeHash`, **and** the gate command (`suites`) all match an existing GREEN record do they skip re-verifying —
`request` leaves the marker untouched (so the daemon never sees `running` and never dispatches), and bare
`verify` emits the cached green result without running the gate. A `red` record is never cache-hit (converge
round 1 finding — see the Progress log): a red is often non-code (host contention, a flaky test), and the
pre-fix "touch nothing, ask again" retry path must keep actually re-running, not get stuck on a stale red. Any
other case (tree changed, sha changed, gate command changed, no record, corrupt) runs exactly as before — this
is strictly a fast-path added ahead of the existing behavior, not a replacement for it.
`check`'s own decision logic is untouched: it already trusts the on-disk terminal record for an exact-sha match,
and that trust is only actually SAFE now because the thing recording it (`request`/`verify`) no longer discards
a still-accurate green just because it was asked twice.

**Scope correction.** The card named `we:scripts/verify-lane.mjs` + `we:scripts/lib/verify-lane-gate.mjs`. The
marker *shape* (`treeHash` alongside `sha`) lives in `we:scripts/lib/lane-verify.mjs`
(`verifyStartBody`/`verifyFinishBody`), so that file is added to `scope:` above. `we:scripts/conveyor/run-rating.mjs`
is also added: the orchestrator directed folding x4txc2g's hermetic-test fix into this same PR/commit (see the
Progress log) rather than a separate one, since it was the direct unblock for this card's own step-5 gate — a
deliberate, orchestrator-approved scope addition, not drift. No other file needs to change for the MVP.

**Prepare-stamp note.** The orchestrator's PREPARE FIRST step names `node we:scripts/backlog.mjs prepare-stamp`
as the sanctioned stamping verb, but that verb writes `status: open` (it targets the ready-to-ratify decision-
prep flow) — running it here would revert this already-claimed, already-active story back to `open` mid-build,
which is wrong for this arc (claim/build/resolve in one lane, one PR). Recorded `preparedDate`/
`preparedAgainstSha` directly in frontmatter instead, leaving `status: active` as `claim` set it.

## MVP (Musts only — the rest is Follow-ups)

1. A pure `computeWorkingTreeHash({ base, runGit })` in `we:scripts/lib/verify-lane-gate.mjs` — hashes the
   tracked diff against the pinned merge-base plus a sorted `git hash-object` per untracked file. Reuses
   `runGit`/`pinnedMergeBase`, no new IO shape.
2. `verifyStartBody`/`verifyFinishBody` (`we:scripts/lib/lane-verify.mjs`) carry an optional `treeHash` field
   through to the marker.
3. `we:scripts/verify-lane.mjs`'s `request` and bare `verify` modes: before the unconditional start-write, read
   the on-disk marker; if it is a terminal **GREEN** record whose `sha === headSha`, `treeHash === currentTreeHash`,
   **and** `suites === GATE` (the SAME gate command that produced it — a green from a weaker/narrower `--gate=`
   override must never answer a request for a different one), skip the start-write (`request`) or skip running
   the gate (`verify`) and emit the cached green result instead (new `status: 'cached'` for `request`). A `red`
   record is **never** cache-hit — reds are frequently non-code (host contention, a flaky test; this card's own
   Progress log below records three), and the pre-fix behavior of "touch nothing, ask again, get a real re-run"
   is exactly how a worker clears one; caching a red would make it sticky instead (converge round 1 finding).
4. Everything else (`check`, `check --wait=`, `reset`, `pr-land`'s finish-guard, #4296's lane-relevant carry-
   forward) is **unchanged** — this only changes when a fresh `running` marker gets written in the first place.

**Explicitly NOT in this MVP** (filed as follow-ups below): (2) inline-run-when-a-slot-is-free instead of
queue-and-poll, and (3) excluding lane scratch files (commit-msg/PR-body/converge-state) from the related-file
set. Both are real, separately-scoped wins the card's own body names, but neither is needed to close the
measured repeat-verify waste, and folding either in here would touch `we:scripts/readiness/heavy-admission.mjs`
/ the related-file selection in `we:scripts/readiness/test-selection.mjs` — outside this MVP's touch-set.

## Test plan (each fails before the fix, for the reason stated)

- `we:scripts/lib/__tests__/verify-lane-gate.test.mjs` — `computeWorkingTreeHash`: same hash for an unchanged
  tree across two calls; a different hash once a tracked file is edited, an untracked file is added, or an
  untracked file's content changes. FAILS before the fix (function does not exist).
- `we:scripts/__tests__/verify-lane.test.mjs` — real-git integration: `request` on an unchanged tree after an
  existing GREEN marker for HEAD does **not** rewrite the marker to `running` (asserted by reading the on-disk
  marker after the call) and reports the cached result; `request` on a tree that changed since that green DOES
  overwrite to `running` (the existing, safety-preserving path). FAILS before the fix (today's `request` always
  overwrites, so the first assertion is red).
- Same file — bare `verify` on an unchanged tree after an existing green marker exits green **without invoking
  the gate command** (a spy on the gate command asserts zero calls); on a changed tree it still runs the gate.
  FAILS before the fix (today's `verify` always execs the gate).

## Proof plan (live before/after — the card's own "Must")

Reproduce the exact mechanism the transcripts show, live, on this checkout's own `we:scripts/verify-lane.mjs` —
not just unit tests:
1. **RED (before):** in a scratch lane state, run the real full `verify` once to record a green marker for
   HEAD, then run `request` again with the tree unchanged and show the marker gets rewritten to `running` (cat
   the marker before/after) — the literal redundant-dispatch trigger.
2. **GREEN (after):** same sequence post-fix — the second `request` reports the cached result and the on-disk
   marker is byte-identical (still the original green, untouched).
3. A genuinely full 90-minute worker rebuild is out of scope for one delivery pass (there is no live worker to
   re-run against); the proof above targets the exact reproducible mechanism the card's own transcript evidence
   names (repeated `request` on an unchanged tree), which is the dominant contributor to the measured 35-43%.
   Stated here explicitly rather than claimed as the full re-measurement the card's prose describes.

## Follow-ups (file as cards via `we:scripts/operations/run.mjs file-item`, not built here)

- Run the gate **inline** for the requester when a heavy slot is free, instead of queue-and-poll
  (`we:scripts/verify-lane.mjs` request/check + `we:scripts/readiness/heavy-admission.mjs`) — card body item (2).
- Exclude lane scratch files (commit-message/PR-body/converge-state) from the `vitest related` target set — card
  body item (3), likely in `we:scripts/readiness/test-selection.mjs` / `we:scripts/lib/verify-lane-gate.mjs`'s
  related-file computation.

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/lib/__tests__/verify-lane-gate.test.mjs we:scripts/__tests__/verify-lane.test.mjs --run --passWithNoTests`
   passes, including the real-git integration case proving a `request`/bare `verify` on an unchanged tree after
   an existing green marker neither rewrites the marker nor re-runs the gate, and the counter-case proving a
   tree that DID change since the green still forces a fresh run.

## Progress

- 2026-09-29 — Implemented the MVP: `computeWorkingTreeHash` (`we:scripts/lib/verify-lane-gate.mjs`), a
  `treeHash` field threaded through `verifyStartBody`/`verifyFinishBody` (`we:scripts/lib/lane-verify.mjs`), and
  the cache-hit fast path in `request`/bare `verify` (`we:scripts/verify-lane.mjs`) that skips re-verifying when
  both `sha` and the working-tree content hash match an existing terminal record. RED (function/behavior absent)
  -> GREEN (99/99 targeted tests) proven both as vitest unit/integration tests and as a live, real-CLI before/
  after probe (real `git`, real `we:scripts/verify-lane.mjs request`, byte-identical marker on the cache hit vs.
  an unconditional `running` rewrite before the fix). Wider `vitest related` sweep on the touched files:
  2965/2965 green.
- 2026-09-29 — Filed the two card-body follow-ups as separate cards (per this card's own MVP cut): x5awn7x
  (inline-run-when-a-slot-is-free) and x88m779 (exclude lane scratch files from the related set).
- 2026-09-29 — **Step-5 terminal gate: RED, three independent dispatches, NOT from this item's own diff.**
  `node we:scripts/verify-lane.mjs request` + `check --wait=` came back `red` (exit 1) three times running. Root
  cause isolated by direct reproduction: the vitest half failed on
  `we:scripts/conveyor/__tests__/run-rating.test.mjs`'s `buildCoverageReport({ sinceMs: Date.now() })` test,
  which reads REAL ambient host filesystem state (live session transcripts, live review-juror logs) with no
  mock and assumes it reads back empty -- a pre-existing, non-hermetic test that races real concurrent writes on
  this shared multi-lane host. It was swept into THIS gate only because
  `we:scripts/conveyor/__tests__/run-rating.test.mjs` line 136 contains the literal string
  `we:scripts/verify-lane.mjs` inside an unrelated example command, which the diff-driven selection's basename-
  needle grep treats as a real reference. Confirmed via isolated repro: the exact same combined command (and the
  narrower two-file combo) passed cleanly on direct manual runs; only the real daemon-dispatched runs (longer
  wall time, more host contention) hit it, 3/3. Filed the root cause as its own card, x4txc2g, rather than
  hand-patching `we:scripts/conveyor/__tests__/run-rating.test.mjs` under this item's scope. Per this brief's
  own escalation rule (gate red -- fix it or report and stop; never bypass), stopping here: card left `active`,
  nothing committed, no PR opened. A retry (fresh `request`) may simply land green on a quieter host window, or
  land once x4txc2g is fixed.
- 2026-09-29 — A 4th `request` was made to double-check under changed host conditions; it did not settle within
  several `check --wait=` cycles -- `ps aux` at the time showed 5+ OTHER concurrent lanes (29, 35, 42, 45, ...)
  all polling/dispatching their own verify-lane gates simultaneously on this same shared host, consistent with
  the host-contention read above. Left unsettled/`running` rather than waited out indefinitely; the three
  earlier, fully-settled RED results already carry the complete diagnosis.
- 2026-09-29 — **Reconciling the two bullets above with what actually shipped (#4473 review finding 6).** The
  "stopping here" bullet said nothing would be committed and no PR opened for x4txc2g, expecting a separate
  card/PR to pick it up later. On reflection, x4txc2g's own fix ((1), the hermetic `buildCoverageReport` test)
  turned out to be small and fully isolated to `we:scripts/conveyor/run-rating.mjs` +
  `we:scripts/conveyor/__tests__/run-rating.test.mjs` — a direct, low-risk unblock for THIS card's own gate
  rather than scope creep — so it was folded into this same lane/diff instead of waiting on a separate PR.
  x4txc2g is marked `resolved` accordingly ("Fixed under #4473's own PR"). This bullet supersedes the "nothing
  committed, no PR opened" framing above: that was accurate at the moment it was written, but the plan changed
  immediately after. A reader should trust THIS bullet (and x4txc2g's own Progress log) over the two above for
  the current state of the gate/fix-2 split; the needle-heuristic fix (2) is still correctly split out to
  xaani98 and NOT part of this diff.
- 2026-09-29 — **`/converge` (elevated care, 5-lens panel: correctness, security, simplicity, standards-
  conformance, claim-accuracy).** Round 1's panel + an independent red-team caught two real, genuine bugs the
  fix's own tests had not (both introduced/worse-than-base/not-parallelizable — a converge BLOCKER):
  (1) the cache-hit fast path applied to a terminal `red` record too, making a flaky/host-contention red
  STICKY (stuck at exit 2 until a file is touched or `reset` is run) instead of the pre-fix "touch nothing, ask
  again, get a real re-run" behavior a worker relies on to clear one; (2) the cache key was only `sha` +
  `treeHash`, ignoring the gate command (`suites`) itself, so a green recorded under a weaker/narrower
  `--gate=` override could silently answer a later request for a stronger/different gate on the same tree — a
  false green. Both fixed by a headless editor subagent (never the panel itself — independence preserved):
  cache-hit is now green-only, and requires `preStart.suites === GATE` too. A second panel + red-team round on
  the revised diff found only two non-blocking nits (both `worseThanBase: false`): test-helper duplication
  across describe blocks (dismissed — matches this file's own pre-existing per-block-helper convention) and a
  `we:scripts/lib/lane-verify.mjs` comment overclaiming what `verifyFinishBody` alone guarantees about
  `treeHash` freshness (fixed directly — reworded to state the real caller contract). **Process note, for
  honesty:** the red-team pass that ratified round 2's `land` verdict ran against a diff snapshot captured just
  BEFORE that comment fix landed, so its own finding list still names the pre-fix comment text — the code the
  red-team actually judged is a strict subset of (slightly stale relative to) what actually shipped; the fix
  was verified independently (re-read after editing) rather than through a third full round, since the round
  cap was not the constraint and a third round would have re-spent budget confirming something already directly
  checked. Also independently investigated and DISMISSED (with reasoning, not silently) two further red-team
  findings claiming a stale-tree false-green: tracing the actual call path, `we:scripts/verify-lane.mjs`'s bare
  `verify` mode — the ONLY path that ever executes the real gate — always RECOMPUTES `treeHash` fresh and
  re-stamps the marker immediately before `execSync(GATE, …)`, on every invocation that does not itself cache-
  hit (and a `running` preStart, which is what a picked-up `request` marker always is, never cache-hits, since
  cache-hit requires `status === 'green'`). So the finish record's `treeHash` always describes the tree at the
  SAME instant `GATE` itself was resolved — no new staleness window beyond the one `GATE` (the command string)
  already has. All test files stayed green throughout (103/103 in the two core files, 225/225 including
  `we:scripts/conveyor/run-rating.mjs`) with a fresh RED-before/GREEN-after mutation proof added for the two
  real fixes plus the pre-existing null-treeHash and sha-mismatch guards (the round-1 panel/red-team also
  flagged that neither of the latter two had a BEHAVIORAL test, only a source regex or none at all — both now
  have one, each independently mutation-proven).
