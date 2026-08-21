---
bornAs: x85ftm4
kind: task
status: open
dateOpened: "2026-08-05"
relatedTo: ["2452"]
tags: [lane-pool, infra]
---

# aheadIsProvablyPushed cannot prove containment when the remote tip object is absent locally

Found while writing the missing ancestor-branch test for PR #1022 (review finding 5). liveRemoteShas reads tips over the NETWORK via ls-remote, but the containment probe needs each tip OBJECT in the LOCAL store. When the remote branch advanced and this clone has not fetched since, the lane reads as unproven and stays protected — the SAFE direction, so this is incompleteness rather than a regression — but the ancestor branch that does ~12 of 14 real clears on the live pool then silently does nothing whenever the clone is behind. Fix: fetch the containing refs before proving.

Both behaviours are pinned today by tests in
we:scripts/__tests__/lane-pool-acquire-stale-origin.test.mjs. Originally observed against the per-tip
`merge-base --is-ancestor <head> <tip>` form, which answered `fatal: Not a valid commit name <sha>` (verified
on git 2.50.1 in a throwaway repo, both directions: it fails before a fetch and succeeds after one) and
`tryGit` mapped to `null`. #2920 has since replaced that with the one-spawn
`rev-list --ignore-missing … --not <shas…>` form, which has the SAME object-locality requirement and merely
drops the unknown tip silently instead of erroring — so the fetch is needed either way (see Design).

## Design

**The one-spawn `rev-list` form is already live** — #2920 landed it, so the card's second option ("prove via
the one-spawn `rev-list` form") is no longer a fork: `aheadIsProvablyPushed` in
[we:scripts/lane-pool.mjs](scripts/lane-pool.mjs) already runs
`git rev-list --ignore-missing --max-count=1 HEAD --not <shas…>`. `--ignore-missing` is exactly what makes the
incompleteness silent: a tip whose object is absent locally is DROPPED from the exclusion set rather than
failing the spawn, so the probe answers "not proven" with no signal. The remaining fix is the fetch.

**Where the fetch goes: the acquire call site's lazy window, not the predicate.** `aheadIsProvablyPushed` is
called from exactly one place — `infoFor(n)` inside `acquire`, guarded by `if (raw.ahead > 0)`, with
`liveRemoteShas(dir)` memoized into `remoteShas` across the pass. `refreshLane`/`status` deliberately read the
raw `laneDirtyOrAhead` fact and must stay untouched (#2452 review moved policy to this one call site on
purpose). So the object-locality repair belongs in the same guarded window.

**Two-phase, so the zero-network common case is preserved.** A blanket per-lane fetch would undo the
"no-per-lane-fetch" property this design is built around. Instead:

1. Run the existing probe. Proven ⇒ done, no network (the ~12-of-14 live clears keep costing nothing extra).
2. Only on an UNPROVEN answer for a lane that looks ahead, run one guarded object fetch in that lane
   (`tryGit(['fetch', '--quiet', 'origin'], dir, { timeout: 8000 })` — the same `timeout` guard
   `liveRemoteShas` already uses), then re-run the probe ONCE.
3. **Memoize that fetch per lane, for the whole pass** — this is load-bearing, not an optimization. Auto-pick
   is a retry loop (`while (chosen === null) { const infos = lanes.filter(…).map(infoFor); … }`), so `infoFor`
   — and therefore phase 2 — is recomputed for **every** still-unresolved lane on **every** lost-race
   iteration. Without memoization the cost is one fetch per ahead-and-unproven lane **per retry**, not per
   pass. Keep a `Set` of lanes already fetched this pass beside the existing `remoteShas` memo (same lazy
   shape, same scope), so the real bound is one extra fetch per ahead-and-unproven lane per acquire pass.
4. Still fails closed: if the fetch fails, times out, or the object is genuinely unreachable, the second probe
   returns unproven and the lane stays protected (#2267). The safe direction is unchanged in every branch.

```js
// we:scripts/lane-pool.mjs — the retry is a wrapper; the pure containment probe keeps its current shape.
// `fetched` is the per-pass memo, hoisted beside `remoteShas` in `acquire` (NOT module state).
function aheadIsProvablyPushed(dir, remoteShas, { fetchOnMiss = true, fetched = null } = {}) { … }
```

Prefer a plain `git fetch origin` over `--prune` here: the probe needs OBJECTS, and pruning is
`refreshLane`'s job, not a read-only containment check's.

## Done when

1. **Executable** — the test that currently pins the limit,
   `it('fails CLOSED when the containing tip is known to the remote but absent locally', …)` in
   [we:scripts/__tests__/lane-pool-acquire-stale-origin.test.mjs](scripts/__tests__/lane-pool-acquire-stale-origin.test.mjs),
   is INVERTED: the same fixture (remote branch advanced, this clone deliberately never fetched) now expects
   `acquire` to exit `0` and print the lane. `npx vitest run lane-pool-acquire-stale-origin` fails before the
   fix on the inverted expectation and passes after. Its comment block, which currently documents the
   incompleteness as deliberate, is rewritten to record that the fetch closes it.
2. **Executable** — the two guards it must not weaken stay green in the same file, unchanged:
   `a GENUINELY unpushed-ahead lane stays protected (never auto-picked)`, and the deleted-remote-ref case —
   a lane whose branch no longer exists on origin must still refuse to be recycled even after the new fetch
   runs. Add the third case if no deleted-ref fixture already covers the post-fetch path.
3. **Executable** — two cost-profile cases, covering both populations the bound has to hold for:
   (a) a pool whose lanes are all PROVEN at the first probe makes **zero** extra fetch calls, so the
   no-per-lane-fetch property #2452/#2920 preserved is not silently traded away; and (b) an auto-pick that
   loses the claim race N times over an ahead-and-unproven lane still fetches that lane **once**, not N
   times — the memo, asserted by counting fetch invocations across a forced-retry run, not by reading the
   code.
4. **Executable** — `npm run check:standards` reports 0 errors.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build) — Independently reproduced in a throwaway repo: `git rev-list --ignore-missing --max-count=1 HEAD --not <missing-sha>` exits 0 and prints HEAD (silently drops the missing sha from the exclusion set rather than erroring) — matches the card's claim that #2920's one-spawn form has the same object-locality requirement as the old merge-base loop, just failing silently instead of loudly.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Card reuses the already-measured live-pool numbers from we:backlog/2452-*.md and we:backlog/2920-*.md (38-lane pool, 29 remote heads, ~12/14 real clears via the ancestor branch) rather than inventing new ones.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Verified `aheadIsProvablyPushed` has exactly one call site in we:scripts/lane-pool.mjs — `infoFor` inside `acquire` (line ~939) — confirming the card's claim that refreshLane and the raw-fact readers are structurally distinct and untouched by this fix.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when item 1 inverts the existing seam test (`fails CLOSED when the containing tip is known to the remote but absent locally`) in we:scripts/__tests__/lane-pool-acquire-stale-origin.test.mjs to assert `acquire` now exits 0 for the same never-fetched fixture — a real round-trip test at the acquire/git seam.
- **population** (NOT addressed; strategy: name the population each threshold guards) — Done-when item 3 only pins the cost profile for the ALL-lanes-PROVEN population (zero extra fetches). It does not cover the population where the auto-pick claim-retry loop (we:scripts/lane-pool.mjs lines 994-1005) recomputes `infoFor` — and therefore the new phase-2 fetch — for every still-unresolved ahead-and-unproven lane on each retry iteration, which is a different (and untested) population than the one the card's stated bound ("one extra fetch per ahead-and-unproven lane per acquire pass") describes.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when item 2 requires the two existing protection tests (`a GENUINELY unpushed-ahead lane stays protected`, and the deleted-remote-ref case) to stay green unchanged — both are real fixture-driven tests today (verified in we:scripts/__tests__/lane-pool-acquire-stale-origin.test.mjs lines 164-211), not tautologies, so this is a genuine non-decorative guard requirement.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Test failure messages are explicit (e.g. `unproven must stay protected — recycling would destroy work`) and Done-when item 1 requires the test's own comment block to be rewritten so the documented behavior matches the new reality, keeping the fail-closed/fail-open distinction legible to future readers.

**Corrections applied by this review:**

- The card states `refreshLane`/`status` are the raw-fact readers left untouched by this fix, but `status` (the `laneStatus` function in we:scripts/lane-pool.mjs) never calls `laneDirtyOrAhead` at all — the other raw-fact reader that must stay untouched is actually `laneAcquirableInfo` (used by `list --acquirable`/`provision --acquirable`, we:scripts/lane-pool.mjs line 660), not `status`.
- The illustrative snippet `function aheadIsProvablyPushed(dir, remoteShas, { fetchOnMiss = true } = {}) { … }` contradicts the card's own preceding design decision ("the fetch goes... at the acquire call site's lazy window, not the predicate") — the snippet adds fetch-retry control directly to the predicate's signature, despite its own comment claiming the predicate "keeps its current shape."

The design is sound, fails closed in every branch, and its factual claims about the live repo (the already-landed #2920 rev-list form, the single infoFor call site, --ignore-missing's silent-drop behavior) all check out — but the card's own illustrative snippet contradicts its stated "fetch lives at the call site, not the predicate" decision, and its cost-profile test only covers the trivial all-proven case, leaving the retry-loop's repeat-fetch behavior under acquire contention unverified.

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** The one NOT-addressed finding (`population`) is correct and is now fixed
in the body: `infoFor` really is recomputed for every non-excluded lane on each iteration of auto-pick's
lost-race retry loop (verified at we:scripts/lane-pool.mjs, the `while (chosen === null)` block), so the
stated bound of "one extra fetch per ahead-and-unproven lane per acquire pass" was false without a memo.
Design step 3 now requires a per-pass fetched-lane memo hoisted beside the existing `remoteShas` memo, and
`## Done when` item 3 gained the second population — a forced-retry run must fetch a given lane once, asserted
by counting invocations. No finding was judged wrong.

