---
bornAs: xlklj7v
kind: task
parent: "2445"
status: open
dateOpened: "2026-07-14"
tags: [plateau-loop, drain-daemon, observability]
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - plateau:tools/drain-daemon/
---

# Emit per-PR head SHA in the merge sweep, then add the head-SHA churn signal to the stuck detector (#2487 follow-on)

#2487 shipped the no-merge-progress stuck signal but DEFERRED the "head SHA churned > K times" variant because the per-PR head SHA is never emitted by the drain. An investigation found the sweep already fetches each PR's tip commit `oid` (via `gh pr view --json commits`, for the AI-authorship gate) but does NOT thread it into the emitted result JSON — so the detector has no way to tell a PR whose tip keeps getting force-pushed (a lane thrashing) from one that is simply waiting.

Two parts:

1. **WE — emit the head SHA.** In [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs), each considered PR already has its per-PR `commits` attached (`p.commits`, fetched at ~L1289 via `gh pr view … --json commits`). Add the tip `oid` (`p.commits[p.commits.length - 1]?.oid`) onto each considered-PR entry in the emitted `result` buckets (`toMerge`/`merged`/`skipped`/`parked`/`deferred`/`failed`). Cheap — no new `gh` call, the data is already in hand. NOTE: [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) is the TRUST_CHAIN lander (engine tier), so the change ESCALATES and needs an independent review panel before it lands — expected, not a blocker.
2. **plateau-app — thread it + detect churn.** Thread the new field through `parsePassResult` (plateau:tools/drain-daemon/lib.mjs) into the persisted journal entry (alongside `consideredPrs`/`mergedPrs`), then add the head-SHA churn signal to the stuck detector (plateau:tools/drain-daemon/lib.mjs `deriveIncidents` / `detectAnomalies` — pure-lib, unit-tested): a PR whose emitted head SHA changes more than K times across the recent pass window is a distinct "lane thrashing / not converging" incident, complementary to the existing no-merge-progress stall.

Impl spans WE (sweep output) + plateau-app (journal + detector). Relates to #2487.

## Design

**The WE half is cheaper than part 1 above assumes, and its cited line is stale.** The merge-candidate
listing in `we:scripts/merge-ai-prs.mjs` already asks GitHub for `headRefOid` in the SAME `gh pr list` call
that fetches labels and check rollups (so does the open-PR context listing). The file even wraps it —
`prHeadSha = (p) => p.headRefOid || null` — and uses it today only as the cross-pass read-cache key. So the
head SHA needs **no** derivation from `p.commits[p.commits.length - 1]?.oid`, and the `~L1289` reference
above no longer points at the commits fetch. One field, already on the PR object.

**The seam is `buildDrainVerdicts`.** That exported pure function in `we:scripts/merge-ai-prs.mjs` is where
every per-PR field is attached to its verdict (`v.repo`, `v.headRef`, `v.prLabels`, plus the manifest fields
via `attachManifestToVerdict`). Attach `v.headSha` there, from `p.headRefOid`, so every downstream bucket
inherits it from ONE place rather than six projections learning the field independently. Then widen the
emitted `result` object's per-bucket projections — `toMerge` and `skipped` are explicit `.map`s;
`merged`, `failed` and `parked` are pushed as object literals — to carry it.

Because `buildDrainVerdicts` is pure and exported, the WE half is unit-testable with no network: hand it a
`prsByRepo` map and a `readOf` stub, assert the verdict carries the head SHA, and assert a PR with no
`headRefOid` yields `null` rather than `undefined` — the journal must be able to tell "not emitted" from
"no tip".

**The plateau half needs a new field, not a widened one.** `parsePassResult`
(`plateau:tools/drain-daemon/lib.mjs`) reduces every bucket to bare PR **numbers** (`consideredPrs`,
`mergedPrs`, `deferredPrs` are integer arrays), so there is nowhere on the existing shape to hang a
per-PR SHA. Add a distinct map — e.g. `headShas` keyed by PR number — built in the same bucket walk that
fills `consideredSet`, and leave the integer arrays alone so no existing consumer changes.

**Escalation is expected.** `we:scripts/merge-ai-prs.mjs` is registered in the trust chain
(`we:scripts/lib/gate-config.mjs`) at **engine** tier, so this change escalates to an independent review
panel — an agent-converged verdict may clear it; no human is forced.

**Sequencing is load-bearing.** Land the WE emit first: the plateau detector cannot be written against a
journal field that does not exist. Then thread it through `parsePassResult`, and only then add the churn
signal to `deriveIncidents` / `detectAnomalies` in the same pure lib.

**Unsettled — the build must pick it deliberately:** `K`, and the window. The existing no-merge-progress
signal already fixes a pass window; reuse it rather than inventing a second one, and put the chosen `K` in
the incident text so an operator can tell why it fired.

## Done when

- `buildDrainVerdicts` attaches the PR's head SHA to every verdict, and a PR with no head SHA gets `null`.
  Both pinned in the existing WE suite; the assertions fail before and pass after:

  ```
  npx vitest run scripts/__tests__/merge-ai-prs.test.mjs
  ```

- Every considered-PR entry in the sweep's emitted JSON carries the head SHA — `toMerge`, `merged`,
  `skipped`, `parked`, `deferred` and `failed` alike. Cheap check on a `--dry-run --json` pass: no entry in
  any bucket lacks the field.
- No new `gh` call is added — the number of `gh pr list` / `gh pr view` invocations in
  `we:scripts/merge-ai-prs.mjs` is unchanged by this diff.
- The plateau lib's own suite gains two cases that fail before and pass after: `parsePassResult` persists
  the per-PR head SHA on the journal entry, and the churn incident fires for a PR whose head SHA changes
  more than `K` times across the window while NOT firing for one that is merely stalled — proving it is
  distinct from the #2487 no-merge-progress signal. (`npm test` in the plateau checkout.)
- The plateau half is not started before the WE emit has landed on `main`.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion BEFORE building) — prHeadSha = p.headRefOid already runs in production today as the cross-pass read-cache key (we:scripts/merge-ai-prs.mjs lines 2627, 2688, 2861), so the field's reliability is already verified by live use, not merely assumed.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Checked both ways: ES-import consumers (we:scripts/fetch-parked.mjs) pull unrelated pure functions and are unaffected; the subprocess/hook caller (plateau:tools/drain-daemon/daemon.mjs, which spawns we:scripts/merge-ai-prs.mjs --json) is the intended consumer and parses defensively (Array.isArray guards in parsePassResult), so an additive field is safe.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card's mandated sequencing (WE emit lands on main before the plateau half starts) means the plateau implementer writes parsePassResult's fixture against the real, already-landed field name rather than a guessed one — the same hand-built-JSON round-trip pattern already used for consideredPrs/mergedPrs in plateau:tools/drain-daemon/lib.test.mjs.
- **population** (NOT addressed; strategy: name the population each threshold guards) — The card leaves K and the window 'unsettled' without naming which PRs constitute normal churn (e.g., PRs the sweep's own rebase/JIT-renumbering machinery legitimately re-heads pass over pass) versus which constitute the 'lane thrashing' population the signal is meant to isolate.
- **unmeasured-impact** (NOT addressed; strategy: measure the constraint before sizing) — No historical head-SHA-churn data can exist before the WE emit lands (#2487 deferred this for exactly that reason), and the card does not call for measuring real post-landing journal data to calibrate K before wiring the detector — it only says 'the build must pick it deliberately.'
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when explicitly requires a differential test — the churn incident must fire for a churning PR and NOT fire for one that is merely stalled — which is exactly a named-test-must-redden requirement, not a decorative assertion.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when requires the chosen K to be embedded in the incident text so an operator can see why it fired, not just that an incident object was pushed.

**Corrections applied by this review:**

- The Design section's enumeration of bucket push-sites to widen ('toMerge and skipped are explicit .maps; merged, failed and parked are pushed as object literals') omits the separate `deferred.push({ num: c.num, item: c.item, waitOn, ... })` site inside `planLabelDrain` (we:scripts/merge-ai-prs.mjs, current line 1457) — even though the card's own Done-when criteria requires deferred entries to carry the head SHA too, and touching that site will require adding a `headSha` key to roughly fifteen existing pinned `toEqual([{ num, item, waitOn }])`-style assertions on `.deferred` in we:scripts/__tests__/merge-ai-prs.test.mjs (e.g. lines 318, 376, 511, 586, 3625, 3775) that the Design narrative never mentions.

The card's factual claims about the live repo check out (headRefOid already fetched, buildDrainVerdicts is the single verdict-build seam, engine-tier escalation, parsePassResult's integer-array shapes, and the existing per-PR considered-never-merged pattern to reuse), but its Design narrative under-describes the actual touch needed for the `deferred` bucket and leaves K/window sizing genuinely unmeasured.

_Recorded through the declared `review-prep` operation._
