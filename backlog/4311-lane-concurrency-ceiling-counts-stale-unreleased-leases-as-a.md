---
bornAs: xkk4lv7
kind: story
size: 5
status: resolved
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/lane-pool.mjs", "we:scripts/conveyor/session-slug.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/lib/lane-concurrency.mjs", "we:scripts/conveyor/build-dispatch-policy.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs"]
dateOpened: "2026-09-27"
dateResolved: "2026-09-28"
preparedDate: "2026-09-27"
preparedAgainstSha: "109fd1b0d3fcbcbaeb8376aa98d55ee9ee882402"
tags: []
---

# Lane-concurrency ceiling counts stale, unreleased leases as active work

Live 2026-09-27 ~6:55pm ET: node we:scripts/operations/run.mjs dispatch-lane --num=4306 refused with 'the build planner held this item: capacity-cap' while we:scripts/conveyor/lane-pool-health-watch.mjs and the tick statusLine both showed 0 building/preparing/fixing/healing — i.e. the tick's own dispatch kinds had zero live work, yet the concurrency ceiling (default 8, we:scripts/lib/lane-concurrency.mjs#DEFAULT_MAX_CONCURRENT_LANES) still read full. Root cause: the ceiling counts every lane we:scripts/lane-pool.mjs status --json reports leased:true for (we:scripts/readiness/dispatch-plan.mjs:404-411 activeLeases.length; we:scripts/conveyor/tick-core.mjs ~L1255-1315 lanes.length from state.lanes), which is correct for a genuinely live session but not for a lease whose work already finished. we:scripts/conveyor/lease-reaper.mjs runs resident every 120s (launchd:com.we.lease-reaper.plist) and would normally reclaim a merged-PR lease within one cycle via its pr-merged axis, but that axis (we:scripts/conveyor/lease-reaper.mjs:814-824, signalsFor) resolves a lease's item/PR number ONLY from lease.session via itemNumFromSession/prNumFromSession (we:scripts/conveyor/lease-reaper.mjs:193-203), matched against the dispatcher-minted grammar in we:scripts/conveyor/session-slug.mjs (conveyor-/prepare-/prepare-decision-/fix-/review-/ci-heal-/inspect-<id>). A lane acquired via a bare we:scripts/lane-pool.mjs acquire --purpose=<slug> with no matching --session=<dispatcher-slug> gets session from defaultSession() (we:scripts/lane-pool.mjs:792 — hostname():process.ppid), which matches none of that grammar, so itemNumFromSession/prNumFromSession both return null (deliberately — never guess), prState never resolves, and sessionGoneForLease also returns null (not a dispatcher-minted name). Such a lease is invisible to BOTH fast axes and reclaimable only by the 4-hour ttl-stale backstop, even once its PR has objectively merged. The same merge-time auto-release (we:scripts/conveyor/pr-watch.mjs --release-session=<slug>, wired only for items we:scripts/conveyor/tick-core.mjs#releaseSessionForNum itself dispatched) never engages either, for the identical reason. Live evidence: lane-2 (purpose soak-gate-merge-base, PR #2825 MERGED) and lane-9 (purpose promote-stale-green, PR #2826 MERGED) both sat leased well past their PR's merge, each occupying one of the 8 ceiling slots the whole time. Fix: give the pr-merged axis a SECOND, session-independent way to resolve a lease's item — read the lane's own checked-out branch (git symbolic-ref/rev-parse inside the lease dir) and match we:scripts/conveyor/lease-reaper.mjs's existing lane/<num>-* grammar (matchLaneRef/laneRefItemNum, we:scripts/conveyor/lease-reaper.mjs:268-275) the same way a PR's headRefName is already matched — an item found either way is enough, never require both. Apply the identical fix to the acquire-native reap backstop (#2748) in we:scripts/lane-pool.mjs, which shares the same itemNumFromSession blind spot.

## Scope & consumers

**Actually edited:**
- we:scripts/conveyor/lease-reaper.mjs — add a new pure-ish, injected-git helper (`laneBranchItemNum` or
  similar) that resolves a held lane's item number from its checked-out branch, reusing the existing
  `matchLaneRef`/`laneRefItemNum` grammar (we:scripts/conveyor/lease-reaper.mjs:268-275) instead of a new
  regex; wire it into `signalsFor` (we:scripts/conveyor/lease-reaper.mjs:814-824) as a fallback when
  `itemNumFromSession`/`prNumFromSession` (session-based) both return `null`. Export the helper.
- we:scripts/lane-pool.mjs — wire the SAME exported helper into `deadLeasePlan` (~we:scripts/lane-pool.mjs:1540),
  which already imports `itemNumFromSession`/`prNumFromSession`/`classifyReap`/`reapPlan`/`prStatesFromList`/
  `prStatesByPrNumber` straight from we:scripts/conveyor/lease-reaper.mjs (we:scripts/lane-pool.mjs:121) so the two reapers stay
  single-sourced — the exact discipline #4113's docblock in we:scripts/conveyor/lease-reaper.mjs already establishes for this
  file; a second, independent regex here would silently re-fork the two reapers.
- we:scripts/conveyor/__tests__/lease-reaper.test.mjs — the failing-before + post-fix fixtures (see Test plan).

**Read-only / cited for context, NOT edited:** we:scripts/conveyor/session-slug.mjs (the dispatcher-minted
grammar this fix supplements, never replaces), we:scripts/readiness/dispatch-plan.mjs and
we:scripts/conveyor/tick-core.mjs (the two consumers of the concurrency ceiling whose `activeCount` this fix
indirectly corrects — by shrinking what counts as "leased", not by changing their own code), and
we:scripts/lib/lane-concurrency.mjs (the ceiling itself — its cap-on-leased-lanes design is correct and
unchanged; the bug is what counts as leased, not the cap logic).

**Consumers of the changed behavior (not code, but downstream effect):**
- launchd:com.we.lease-reaper.plist — the resident 120s daemon that runs we:scripts/conveyor/lease-reaper.mjs;
  after this fix it reclaims more leases per pass (previously-invisible ones), same CLI/JSON shape (`scanned`/
  `reaped`/`kept`/`prAxis`/`sessionAxis`) — no consumer of that JSON needs to change.
- Every we:scripts/lane-pool.mjs acquire caller (dozens, across skills-src/conveyor, scripts/operations,
  scripts/conveyor) — benefits from `deadLeasePlan`'s pre-acquire reap backstop catching more ghosts, with
  no interface change (still gated by `--no-reap` exactly as today).
- we:scripts/readiness/dispatch-plan.mjs / we:scripts/conveyor/tick-core.mjs — their own `activeLeases`/
  `state.lanes` reads shrink once dead leases are actually gone; no code change needed there, per above.

## Risks

1. **Blast-radius / never reap a live worker's lane.** The branch-based lookup MUST reuse the exact existing
   `matchLaneRef` regex and the existing "open wins" reduction (`prStatesFromList` in
   we:scripts/conveyor/lease-reaper.mjs) — a lane on a `lane/<num>-*` branch whose PR is still `open` must
   never misread as `merged`. No second, divergently-tuned parser.
2. **Retry-suffix collision.** `lane/2500b-*` vs `lane/2500-*` must collapse to the same base number exactly as
   `matchLaneRef` already does for the session-slug path (we:scripts/conveyor/lease-reaper.mjs:126-131), so a
   live retry's branch is never read as an older terminal PR's number.
3. **Fail-closed on an ungrammatical/detached branch.** `git symbolic-ref --short HEAD` can fail (detached HEAD,
   mid-rebase) or return a name outside the `lane/<num>-*`/`lane/x[a-z0-9]{5,7}-*` grammar — must return `null`
   (same "never guess" contract the session lookup already follows), never throw and abort the whole reap pass
   for other candidates in the same run.
4. **Population — don't narrow the existing session-based coverage.** A PR_KIND session (`fix-`/`review-`/
   `ci-heal-`/`inspect-<PR>`) may work inside a lane whose branch does NOT encode the item the same way; the
   branch lookup must be an OR-fallback (`itemNumFromSession(...) ?? laneBranchItemNum(...)`), never a
   replacement — session wins when it resolves, branch only fills the gap when session returns `null`.
5. **Consumer drift.** we:scripts/lane-pool.mjs's `deadLeasePlan` must import the new helper from
   we:scripts/conveyor/lease-reaper.mjs rather than duplicate it — see Scope above.
6. **Performance.** One extra `git symbolic-ref`/`rev-parse` per HELD candidate lease, per 120s reaper pass and
   per acquire call — bounded with the same `resolveChildTimeoutMs()` every other per-lane git read in this
   file already uses (e.g. we:scripts/conveyor/lease-reaper.mjs's `fetchPrStatesForRepo`); candidate count is
   held leases only, not the whole pool, so this stays cheap.
7. **Unmeasured-impact — card #4306 in flight.** Per the light plan review (below), #4306's LOCAL, uncommitted
   diff (inspected directly, not via a published PR) touches completion-record ownership and session-generation
   binding — it changes neither we:scripts/conveyor/driver-watchdog.mjs nor its pid-alive-probe signatures, and
   touches none of this card's proposed files. No dependency conflict found against that snapshot; re-check once
   #4306 actually lands, since a local diff is not a verified final PR.
8. **BLOCKER, found by light plan review — namespace precedence.** The original one-line design
   (`itemNum = itemNumFromSession(...) ?? laneBranchItemNum(...)`) is UNSAFE: `itemNumFromSession('fix-900')`
   correctly returns `null` for a PR-kind session (only `prNumFromSession` resolves it, to `900`), but the naive
   fallback would still populate `itemNum` from the lane's branch — and `signalsFor` PREFERS `byItem` over `byPr`
   whenever `itemNum` is non-null, so a correctly-resolved PR-kind lookup (`open`, correctly kept) gets silently
   overridden by a branch-derived item lookup that can name an entirely different, unrelated, already-merged
   item. Reproduced live: a `fix-900` fixture (PR #900 open, branch tied to a DIFFERENT merged item) — today's
   code correctly returns `keep`; the naive fallback returns `reap, reason: pr-merged`. **Fix: only invoke the
   branch fallback when BOTH `itemNumFromSession` AND `prNumFromSession` return `null`** (i.e. `session` matches
   no dispatcher grammar at all — neither an item-kind nor a PR-kind session), never merely when one namespace is
   null. See the revised Decided design below.
9. **BLOCKER, found by light plan review — a branch names past work, not the current holder.** `classifyReap`
   prioritizes a terminal PR state over any liveness signal — reproduced live: a fixture with `sessionGone: false`
   and `pidAlive: true` (i.e. POSITIVELY confirmed alive) still returned `pr-merged` once the branch-derived
   lookup fired, because `classifyReap`'s axis order checks PR-terminal before session-gone. A lease can
   legitimately retain an OLD branch whose PR already merged while doing genuinely NEW, live work in that same
   lane (a second pass reusing the branch, or a retry started before a fresh PR opened) — reaping on the branch
   name alone, with no corroborating check that nothing NEW has happened since the merge, would violate the
   "never reap a live worker's lane" invariant. See the revised Decided design below for the required safety
   gate.

## Decided design

**Fork 1: how does a lease whose `session` doesn't fit the dispatcher-minted grammar ever become reapable on the
fast (pr-merged) axis?**
- **Option A — convention/discipline**: require every one-off/mechanical pass (`soak-gate-merge-base`,
  `promote-stale-green`, and any future one) to pass an explicit dispatcher-recognizable `--session=<slug>` at
  acquire time.
- **Option B (DECIDED) — branch-based fallback, implemented once, centrally, gated to the truly-unrecognized
  population**: resolve the item from the lane's own checked-out `lane/<num>-*` branch (the SAME grammar already
  used to key a PR's `headRefName`), consulted ONLY when NEITHER `itemNumFromSession` NOR `prNumFromSession`
  resolves anything (risk 8 above) — never when either already answers, even if the other didn't.

**Why B, not A:** A carries no retroactive effect (it only helps FUTURE acquires that remember the convention,
and nothing enforces it), and it fixes nothing for a lease that already exists without it — matching the
"we always fix the mechanism, never work around it by hand" doctrine and "failures improve the product,
never manual fixes." B is mechanical, applies to every existing and future non-dispatcher lease automatically,
and reuses a parser (`matchLaneRef`) this file already trusts for the identical grammar on the PR side — no new
trust surface, PROVIDED it carries the Fork 2 safety gate below.

**Fork 2 (surfaced by light plan review round 1, risk 9 above; REVISED again after round 2 — see below): once
the branch names a merged/closed PR for an unrecognized-session lease, is that alone sufficient to reap it?**
- **Option A — reap immediately on the branch-derived terminal state**: REJECTED — proven live to reap a
  positively-confirmed-alive lease.
- **Option B (round-1 answer, INSUFFICIENT per round-2 review) — a "nothing new since the merge" tree check
  alone**: clean working tree + HEAD already contained in the merged PR. **Round-2 finding: this is not enough.**
  A genuinely live worker that is reading, planning, or running tests — with no new commit or dirty file YET —
  passes a clean/contained-HEAD check while still being alive; "no persisted new work" does not prove "finished
  or gone." Also confirmed by round-2: this repo's existing liveness signals
  (`sessionGoneForLease`/`pidAliveForLease`) are STRUCTURALLY unable to help here — both are gated on a
  recognized dispatcher-minted session name (we:scripts/conveyor/lease-reaper.mjs:528-556), and this fallback
  exists PRECISELY for leases whose session is NOT dispatcher-minted, so neither signal is ever anything but
  `null` (unknown) for this exact population. There is no positive-liveness signal to veto on, today.
- **Option C, ROUND-2 SHAPE (INSUFFICIENT per light-review round 3) — quiet window anchored to the PR's own
  `mergedAt` alone**: round 3 found a real gap even in this: a lease ACQUIRED FRESH against a lane whose branch's
  PR merged, say, yesterday would pass "clean + contained HEAD + `mergedAt` older than 30 minutes" the INSTANT
  it is acquired — reaping a worker that has barely started reading/planning, because the clock was measured
  from the wrong event (the PR's merge, not this holder's occupancy).
- **Option C, FINAL (DECIDED) — anchor the quiet window to the LATER of the PR's `mergedAt` and THIS lease's
  own `acquiredAt`**: the branch-derived `pr-merged`/`pr-closed` reap fires only when ALL of: (1) the working
  tree is clean, (2) HEAD is already contained in the merged PR (both still required — they rule out a worker
  that HAS produced new, real, un-landed work), AND (3)
  `nowMs - max(Date.parse(prMergedAt), Date.parse(lease.acquiredAt)) >= quietMs` (a NEW, conservative "quiet
  window" — default 30 minutes, well short of the existing 4-hour TTL). Anchoring to `max(...)` rather than
  `prMergedAt` alone is what closes round 3's gap: a FRESH holder of an old-merged-branch lane always gets its
  own full 30-minute grace from `acquiredAt`, regardless of how old the PR is; missing/unparseable timing data
  on EITHER side fails closed (`null`, never a guess — the fail-closed contract every other axis in this file
  already follows). This is the honest answer to "no liveness signal exists for this population": since we
  cannot ask "is the holder alive," we instead ask "has THIS holder had a fair, bounded chance to show it is" —
  the same grace-window shape we:scripts/conveyor/lease-reaper.mjs's OWN `sessionGoneForLease` already uses for
  a DIFFERENT signal (absence-from-listing) at `DISPATCH_GUARD_LISTING_GRACE_MINUTES` (10 minutes) — applied
  here to a signal that has no listing to wait on at all. Never claims to prove liveness; only bounds the
  exposure window from "up to 4 hours" down to "up to ~30 minutes since whichever of merge-or-acquire happened
  LAST," which is the actual, honestly-stated win.

This design directly answers all three blockers found across both review rounds: Fork 1 stops the fallback from
ever outranking a correctly resolved PR-kind lookup; Fork 2/Option C stops a bare branch name (or a merely-clean
tree) from ever authorizing an IMMEDIATE reap — it can only shrink the exposure window, never claim to prove a
holder is gone, which is the accurate framing this population's total absence of liveness signal actually
supports.

## Interfaces & protocol

- New export from we:scripts/conveyor/lease-reaper.mjs, e.g.:
  `export function laneBranchItemNum(dir, { git = defaultGitSymbolicRef } = {}) -> string|null`
  — `dir` is the lane's working-tree path; the injected `git` fn returns the checked-out branch name (or throws/
  returns null on failure); the function matches it via the existing (currently-private) `matchLaneRef` and
  returns the same `num` shape `laneRefItemNum` returns (`string|null`, hash keys lower-cased) — no new return
  shape to learn.
- A second new export/helper implementing Fork 2/Option C's safety gate, e.g.:
  `export function laneQuietSincePr(dir, { prMergeSha, prMergedAt, leaseAcquiredAt, nowMs, quietMs =
  DEFAULT_QUIET_MS, git } = {}) -> boolean|null` — `true` only when ALL of: the working tree is clean, HEAD is
  an ancestor-or-equal of `prMergeSha` (reuse we:scripts/lane-pool.mjs's existing dirty/ahead-detection
  primitives — `git status --porcelain` + a merge-base/`--is-ancestor`-equivalent — rather than re-deriving
  them), AND `nowMs - Math.max(Date.parse(prMergedAt), Date.parse(leaseAcquiredAt)) >= quietMs` (`DEFAULT_QUIET_MS`
  — DECIDED default 30 minutes, well short of the existing 4-hour TTL; anchored to the LATER of the two
  timestamps per Fork 2/Option C's final round-3 revision — a fresh acquire against an old-merged branch always
  gets its own 30-minute grace from `leaseAcquiredAt`, never an instant reap off a stale `prMergedAt` alone).
  `null` on any git-read failure or EITHER missing/unparseable timestamp (never a guess, mirrors every other
  axis's fail-closed contract in this file). `leaseAcquiredAt` is already on every lease marker
  (`lease.acquiredAt`, we:scripts/lane-pool.mjs's own `leaseBody` shape) — no new field to add.
- `signalsFor` in `main()` (we:scripts/conveyor/lease-reaper.mjs:814-824) changes as follows (Fork 1 + Fork 2,
  NOT the single null-coalesce line originally proposed — that design was a confirmed blocker across two light
  plan review rounds, see Risks 8-9):
  ```
  let itemNum = itemNumFromSession(c.lease?.session);
  const prNum = prNumFromSession(c.lease?.session);
  if (itemNum == null && prNum == null) {
    const branchNum = laneBranchItemNum(c.dir);
    // Fork 2/Option C — only trust it once corroborated: resolve the branch's own PR state FIRST, then
    // require BOTH "no new work since that PR's merge" AND "a conservative quiet window has passed" —
    // this population has NO liveness signal at all (see Fork 2's own doc), so this can only ever bound
    // the exposure window, never prove the holder is gone.
    if (branchNum != null) {
      const branchPrState = repoStates?.byItem.get(branchNum) ?? null;
      const corroborated = branchPrState?.state === 'merged' || branchPrState?.state === 'closed'
        ? laneQuietSincePr(c.dir, { prMergeSha: branchPrState.sha, prMergedAt: branchPrState.mergedAt, leaseAcquiredAt: c.lease?.acquiredAt, nowMs }) === true
        : true; // an OPEN branch PR needs no extra corroboration — "open wins" already protects it
      if (corroborated) itemNum = branchNum;
    }
  }
  ```
  (Illustrative — exact shape is the builder's call, but the ORDER — resolve both namespaces first, only
  consult branch when both are null, only trust a terminal branch-derived verdict once BOTH tree-state AND
  quiet-window corroborate it — is not optional; it is what closes Risks 8 and 9.) `c.dir` is already present on
  every candidate (we:scripts/conveyor/lease-reaper.mjs:801), no new field needed on candidates.
  `prStatesFromList`'s reduction may need to start carrying each PR's merge commit SHA AND `mergedAt` (verify
  against the actual `gh pr list --json` field list, `we:scripts/conveyor/lease-reaper.mjs:699` — `mergedAt` is
  already fetched per this file's own `reduceTerminalStates`; the merge commit SHA may need adding) for
  `laneQuietSincePr` to have something to compare HEAD and elapsed time against.
- we:scripts/lane-pool.mjs's `deadLeasePlan` (~line 1549, confirmed TTL-gated per the light plan review — see
  Risks) gets the identical two-fork change, importing both new helpers alongside its existing
  we:scripts/conveyor/lease-reaper.mjs imports (we:scripts/lane-pool.mjs:121); its candidates already carry a
  lane dir/path (verify exact field name against we:scripts/lane-pool.mjs's own candidate shape before wiring —
  do not assume it matches we:scripts/conveyor/lease-reaper.mjs's `c.dir` verbatim). Because `deadLeasePlan` is
  already TTL-gated for both its existing signals, adding this fallback does not change ITS timing guarantee
  (still bites only once stale) — the real win from this fix is entirely in the RESIDENT 120s
  we:scripts/conveyor/lease-reaper.mjs pass, which has no such gate.
- No CLI flag, no JSON output shape change, no new env var — this is an internal resolution-signal addition,
  not a new capability surface.

## Tasks

1. Read we:scripts/lane-pool.mjs's `deadLeasePlan` candidate shape (~L1501-1567) to confirm the exact field
   name for a candidate's lane directory (mirror, don't assume, we:scripts/conveyor/lease-reaper.mjs's `c.dir`),
   and confirm (per the light review) that both its PR-terminal and item-resolved signals really are
   TTL-gated today — do not silently change that gating as a side effect of this fix.
2. Add `laneBranchItemNum` AND `laneQuietSincePr` (names TBD at build time) to
   we:scripts/conveyor/lease-reaper.mjs, reusing `matchLaneRef` and we:scripts/lane-pool.mjs's existing
   dirty/ahead git primitives rather than re-deriving either.
3. Wire BOTH into `signalsFor` (we:scripts/conveyor/lease-reaper.mjs:814-824) per the Interfaces section above —
   resolve `itemNum`/`prNum` from session first, consult the branch ONLY when both are null, and require Fork
   2/Option C's corroboration (clean tree + contained HEAD + quiet window elapsed since the PR's merge) before
   trusting a terminal branch-derived verdict.
4. Wire the identical two-fork logic into we:scripts/lane-pool.mjs's `deadLeasePlan`, importing rather than
   duplicating.
5. Add the failing-before fixture + post-fix assertion to we:scripts/conveyor/__tests__/lease-reaper.test.mjs
   (see Test plan) — run failing-before FIRST, confirm the pre-fix build actually fails it, then implement, then
   confirm it passes. Include the namespace-conflict (`fix-<PR>` + unrelated merged branch) and
   fresh-holder/live-work (branch merged, but new uncommitted work or new commits on top) regression cases the
   light plan review's own probes proved necessary — these are not optional additions, they are what makes the
   design safe.
6. Add/extend an equivalent fixture in we:scripts/lane-pool.mjs's own test suite for `deadLeasePlan`.
7. Run the affected vitest files plus `npm run check:standards`.
8. Live proof (see Test plan) — dry-run against the real pool, before/after.

## Delivery shape

Lands as ONE PR, one lane. The change is purely additive (a new fallback signal on two existing call sites) —
no flag, no incremental seam needed; nothing about it changes behavior for a lease the session-based lookup
already resolves.

## Test plan / proof plan

**Revised per the light plan review** (the original #1/#2 pair was a characterization test against
`classifyReap` directly, not a real regression through the production signal-resolution path — `signalsFor` is
private inside `main()`, so the build must add an injectable seam, e.g. exporting the composed resolver or
testing at the CLI/fixture level `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` already uses elsewhere):

1. **Failing-before regression** (prove the gap through the REAL resolution path, not a hand-picked
   `classifyReap` call): a fixture lease `{ session: 'Mac:12345' }` (a non-dispatcher-minted session — the
   `defaultSession()` shape, we:scripts/lane-pool.mjs:792) whose lane dir is on git branch
   `lane/2825-soak-gate-merge-base`, with a `gh pr list` fixture reporting PR #2825 `state: MERGED` AND a
   matching `headRefName: 'lane/2825-soak-gate-merge-base'` (not merely the bare PR number — the light review
   flagged that PR fixtures must carry a real matching head ref, since that is what `matchLaneRef`/
   `laneRefItemNum` actually key off). Run it through the exported/injectable resolution seam (pre-fix) and
   assert `keep` — this is TODAY's real, current behavior, not a hypothetical.
2. **Post-fix assertion**: same fixture, through the fixed resolution path — assert `reap`, `reason: 'pr-merged'`.
3. **Namespace-conflict regression (Fork 1 — REQUIRED, not optional)**: a `fix-900` session, PR #900 `open`,
   whose lane's branch happens to be tied to a DIFFERENT, already-merged item. Assert the result stays `open`/
   `keep` — i.e. the branch fallback must NEVER fire when `prNumFromSession` already resolved something,
   confirmed by the light review's own live probe of the naive (rejected) design.
4. **Fresh-holder / live-work regressions (Fork 2/Option C — REQUIRED, not optional; THREE rounds of light plan
   review each found the prior design unsafe here — see Risks 8-9)**:
   - a lease on a branch whose PR has merged, but the lane ALSO carries new uncommitted changes (or new commits
     ahead of the merge point) — assert `keep` (falls through to TTL), never `reap`.
   - the SAME branch/merged-PR shape, clean + contained HEAD, but the PR merged LESS than the quiet window ago
     (e.g. 5 minutes) AND the lease was ALSO acquired long ago (irrelevant, `mergedAt` is the more recent of the
     two) — assert `keep`: the exact "a live worker reading/planning/testing, no persisted changes yet" scenario
     round 2 proved reaps incorrectly under a tree-check-only design.
   - **round-3 case, REQUIRED**: the SAME branch/merged-PR shape, clean + contained HEAD, PR merged LONG ago
     (e.g. yesterday) BUT the lease was ACQUIRED FRESH (e.g. 5 minutes ago) — assert `keep`: this is the exact
     gap round 3 found in an `mergedAt`-only quiet window (it would have reaped a holder that just started) —
     proves the fix correctly anchors to `max(mergedAt, leaseAcquiredAt)`, not `mergedAt` alone.
   - the SAME shape, clean + contained HEAD, BOTH the PR's merge AND the lease's acquisition are older than the
     quiet window — assert `reap`.
   These four cases are what actually close Risks 8-9 across all three light plan review rounds.
5. **Regression**: existing item-kind (`conveyor-<num>`) and PR-kind (`fix-`/`review-`/`ci-heal-`/`inspect-<PR>`)
   session fixtures in we:scripts/conveyor/__tests__/lease-reaper.test.mjs still resolve identically.
6. **Hash-branch case**: note (per the light review) that `matchLaneRef` accepts a hash id
   (`lane/3095-*`) that `parseSessionSlug` deliberately never does — the branch fallback therefore makes a
   previously-unreachable hash-keyed PR state usable for reaping for the first time. Add an explicit fixture for
   it rather than leaving it as an untested side effect of reusing `matchLaneRef`.
7. **Acquire-time TTL preserved**: a fixture proving we:scripts/lane-pool.mjs's `deadLeasePlan` still requires
   `isLeaseStale(...)` before either the PR-terminal or the new branch-derived signal fires — the light review
   confirmed `deadLeasePlan` is ALREADY TTL-gated on both existing signals (we:scripts/lane-pool.mjs:1549); this
   fix must not accidentally remove that gate.
8. **Live proof (before/after on the real incident, not only unit tests)** — with an HONEST scope: lane-2 and
   lane-9's original leases were already gone (naturally released) by the time of the light plan review, so the
   original incident is no longer live-reproducible; the design gap itself is proven by tests 3-4 above using
   the actual production functions, which is the de-risking evidence this checklist item requires. Once landed,
   run `node we:scripts/conveyor/lease-reaper.mjs --dry-run --json` against the live WE pool and confirm no held
   lease is BOTH (a) confirmed `merged`/`closed` via its branch and (b) sitting on a clean, unadvanced working
   tree while still reported `kept` for lack of session-grammar recognition. Separately confirm
   `node we:scripts/operations/run.mjs dispatch-lane --num=<a queued item still held capacity-cap>` moves off
   `capacity-cap` once genuinely-dead leases are gone (it may still legitimately hold if real work fills the cap
   — the invariant is "counts only live work," not "never holds").

## Related manifestation — the SAME defect also inflates we:scripts/conveyor/build-dispatch-policy.mjs's own cap (folded in 7:10pm ET)

**New evidence (7:10pm ET):** the build-dispatch daemon's `--dry-run` (we:skills-src/conveyor/build-dispatch-daemon.mjs)
reported tick-core counting `5 building` while durable in-flight builds (claims + run records,
we:scripts/conveyor/build-dispatch-claim.mjs) showed `none`, holding every queued item `[cap] 5 builds in flight`
(the `cap` rule in we:scripts/conveyor/build-dispatch-policy.mjs:206). `claude agents --json` separately listed 18
`conveyor-NNNN` sessions in state `working`, 20+ days old, with dead pids.

**Investigated and RULED OUT, by direct live test, not assumption:** the hypothesis that these 18 dead-pid
`claude agents` sessions inflate `durableBuildNums`/`externalBuilding` was tested against the REAL running system
(`claude agents --json` + a real `ps aux` scan + the actual production `resolvePidAlive`/`durableBuildNums`
functions, invoked directly, no mocks) — `we:scripts/conveyor/tick-core.mjs#durableBuildNums` correctly excludes
all 18 (their `pid` is `null` and their `sessionId` is confirmed ABSENT from a real `ps aux` snapshot, so
`resolvePidAlive` correctly resolves `false` for every one), returning `[]`. The #3383-follow-up `pidAlive`
exclusion (we:scripts/conveyor/tick-core.mjs:483-489, wired via we:scripts/conveyor/tick-core.mjs:1805-1820) works
correctly and is NOT the cause here. (Also checked and ruled out: PID reuse on the `pid` field, and a
sessionId-substring false-positive in the `ps aux` scan — neither reproduces against real data.)

**REAL cause: the same defect as this card's main root cause, showing up in a second counter.**
we:scripts/conveyor/tick-core.mjs#computeTickCounts's `building` tally (~we:scripts/conveyor/tick-core.mjs:1030-1048)
unions `buildGuardNums` (correctly pid-filtered, per above) with `buildLaneNums` — every LEASED lane whose
lane-ports `--item=` mapping is populated, with NO check that the lease's underlying work is still actually
running. `d.counts.building` feeds directly into `externalBuilding`
(we:skills-src/conveyor/build-dispatch-daemon.mjs:150), and
`busy = Math.max(running.length, externalBuilding)` (we:scripts/conveyor/build-dispatch-policy.mjs:180) — so a
STALE, unreleased lease (this card's exact Root Cause) inflates the NEW build-dispatch daemon's own `[cap]` hold
the identical way it inflates the lane-concurrency ceiling.

**NARROWED per the light plan review (this claim was originally over-stated):** a direct probe confirmed
"removing an affected lease's mapping reduces `building` by exactly one" (mechanically true — `computeTickCounts`
is a pure set union) — but that supports only "reaping an affected stale lease removes ITS OWN contribution to
the count," not "this fix generally reconciles the two counters" or "the five originally-observed `building`
entries were all this exact shape." `d.counts.building` legitimately counts real work outside
we:scripts/conveyor/build-dispatch-claim.mjs's claims/run-records too (leased build lanes with no daemon claim
yet, e.g. a build dispatched by a path other than the new daemon), so equality between the two counts is NOT a
valid general completion criterion, and an unrecognized-session lease abandoned BEFORE ever opening a PR (no
branch-derived PR state to find at all) still has no fast path here — it still waits on TTL or another axis.
**What is fixed:** every stale lease reachable via a terminal branch state (this card's exact mechanism) stops
contributing to either counter. **What is NOT claimed:** that this is the ONLY source of inflation in the
build-count path, or that the two counters become generally equal.

**Fresh live instance, same defect — status as of the light plan review:** at investigation time (~7:15pm ET),
lane-10 was leased with `session: "build-4306"` — the active build-dispatch-daemon's own in-flight dispatch of
card #4306. `"build-4306"` does not match we:scripts/conveyor/session-slug.mjs's recognized grammar
(`ITEM_KINDS = ['conveyor', 'prepare', 'prepare-decision']`; `parseSessionSlug`'s regex has no `build`
alternative) — `itemNumFromSession('build-4306')` returns `null`, confirmed directly. The CORRECT convention
already exists and is used elsewhere: we:scripts/operations/dispatch-lane.mjs#sessionSlugFor (line ~458)
translates a `'build'` launch kind into `'conveyor'` before minting, so a normal dispatch mints `conveyor-<num>`,
not `build-<num>`. How this ONE lease ended up named `build-4306` instead was not traced further inside this
investigation's time-box — flag it for whoever builds this card to re-check. **By the time of the light plan
review, lane-10 was checked out on branch `main` (no PR yet opened for #4306), so the branch-based fallback
could NOT yet have resolved it** — the earlier claim that this card's fix "closes this occurrence with no extra
code" is only true ONCE a PR opens on a `lane/4306-*` branch; it is not something this investigation directly
observed working, only something the design implies once that branch exists. Also by that time, lane-2 and
lane-9 (the card's original evidence) had no lease markers at all — both were naturally released in the
interim, so neither the ORIGINAL incident nor the `build-4306` case remained live-reproducible; see the Test
plan's honest scope note on this.

**Open-PR conflict check: INCONCLUSIVE, not clear.** The light plan review attempted `gh pr list` and a
GitHub API lookup for #4306 and both failed (`error connecting to api.github.com` — no network egress in this
sandboxed environment). It separately inspected #4306's LOCAL uncommitted diff (a snapshot in a sibling lane,
not a published PR) and found it touches completion-record ownership and session-generation binding, changing
neither we:scripts/conveyor/driver-watchdog.mjs nor its pid-alive-probe signatures, and touching none of this
card's proposed files — no conflict found against that snapshot, but this is NOT a substitute for checking the
real, merged/open state of #4306 and any other open PR touching we:scripts/conveyor/lease-reaper.mjs,
we:scripts/lane-pool.mjs, or we:scripts/conveyor/session-slug.mjs once network access is available (e.g. from
the main session, before landing).

**Scope addendum:** we:scripts/conveyor/build-dispatch-policy.mjs, we:skills-src/conveyor/build-dispatch-daemon.mjs
and we:scripts/conveyor/build-dispatch-claim.mjs are READ-ONLY / cited context for this manifestation — NOT
edited by this card's fix. If a future investigation finds `build-<num>` session-naming is a real, repeated drift
(not a one-off), that is a SEPARATE follow-up against we:scripts/operations/dispatch-lane.mjs and/or whatever
minted this specific lease — out of scope here.

**Test plan addendum:** add one more fixture alongside the Test plan above — a lease with `session: 'build-4306'`
(the exact live shape observed), lane branch `lane/4306-<slug>`, PR open (not yet merged) — asserts the branch
fallback resolves item `4306` for scope/overlap purposes even though `itemNumFromSession` returns `null`, and
(separately) once that PR merges, the SAME lease reaps on `pr-merged` via the branch-based lookup — proving the
fallback generalizes beyond the `soak-gate-merge-base`/`promote-stale-green` shape the primary fixture uses.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/lease-reaper.test.mjs` includes the
   non-dispatcher-session/merged-PR/`lane/<num>-*`-branch fixture AND the Fork-1 (namespace-conflict) AND
   Fork-2 (fresh-holder/live-work) regression fixtures from the Test plan above, all fail on pre-fix HEAD in
   the direction each is meant to catch and pass post-fix; AND a live
   `node we:scripts/conveyor/lease-reaper.mjs --dry-run --json` run shows zero held leases that are BOTH (a)
   confirmed `merged`/`closed` via a `lane/<num>-*` branch match with a clean, unadvanced working tree and (b)
   still reported `kept` for lack of session-grammar recognition (the exact shape lane-2/lane-9 exhibited).
2. **Executable (build-count manifestation, NARROWED claim)** — for the specific stale-lease shape this fix
   catches, the same `--dry-run` on we:skills-src/conveyor/build-dispatch-daemon.mjs no longer counts that
   lease toward `[cap] N builds in flight` once its lease-reaper pass reclaims it. This does NOT assert general
   equality between `we:scripts/conveyor/tick-core.mjs#computeTickCounts`'s `building` count and
   we:scripts/conveyor/build-dispatch-claim.mjs's durable claims/run-records count — that would be a false
   claim per the light plan review; only THIS card's exact stale-lease shape is asserted fixed.
