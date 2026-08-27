---
bornAs: xbi8dmf
kind: decision
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
codifiedIn: one-off
relatedTo: ["2138", "2153", "2152", "2692", "2740", "2704", "2680"]
relatedReport: reports/2026-08-26-ci-batch-verification-and-strict-up-to-date.md
tags: [ci, drain, merge-queue, branch-protection]
---

# Batch-verify queued lanes in CI instead of re-testing every PR against a moving main

Strict up-to-date branch protection marks every queued PR BEHIND the moment one lands, so the drain rebases it and re-runs the full ~6min required suite per PR. A prep pass found the batch-gate turf already ruled and deferred by #2692 behind an unmeasured trigger, so the open question is not which batching design but whether the deferral trips.

Research: [CI Batch Gate vs Strict Up-To-Date Branch Protection](/research/ci-batch-gate-vs-strict-up-to-date/) · report `we:reports/2026-08-26-ci-batch-verification-and-strict-up-to-date.md`

> **Superseded — read the RULED section at the bottom first.** The prep record below stands as history: it
> is what the pass found *before* the post-prep investigation overturned part of it. The card is resolved.

## Prep verdict — NOT prepared; the question was reframed

A prep pass ran on 2026-08-26 (prior-art survey, measurement, mandated skeptic + fresh-context screen).
**It did not produce a ratifiable fork set — it dissolved the one it started with.** `preparedDate` is
deliberately unstamped; this item is `○ needs prep` against the *reframed* question below, not against the
four forks the first draft carried.

The prep pass is still recorded here in full, because what it destroyed and what it measured are both
durable.

## The blocking reconciliation — #2692 already ruled and deferred this

The first draft proposed a batch gate without citing the statute that governs it.
[`#event-driven-land-is-wake-only`](../../docs/agent/platform-decisions.md#event-driven-land-is-wake-only)
(ratified 2026-07-27, operator, #2692):

- **Clause 3** defers *"the full event-driven MERGE-QUEUE build — speculative merge-commit preserving the
  signed-off SHA, per-step CAS/idempotent transaction-tail guards, **and the batching rider**"* behind a
  **measured `land-serialization` saturation trigger** (#2680's metric: *k > 1 ready PRs queued behind the
  sole writer, sustained over the window*). The ruled defaults are **pre-attached** precisely so that *"no
  re-litigation is needed"* when it fires.
- **Clause 4** requires the un-gate to **surface and route** through #2704 criticality decision-routing,
  possibly to operator confirm — it *"does not autonomously execute the build."*
- **#2740**, the tripwire that measures the trigger, is `status: open`. Never built. **No measured trip has
  occurred.**

Ratifying the first draft would have un-deferred the batching rider without its trigger, bypassed the
required routing, and re-opened forks #2692 declared closed — after a human had spent their ratification,
when the call is immutable. That is the class of miss prep exists to catch.

Separately,
[`#gate-on-merged-tree-lane-fast-fail`](../../docs/agent/platform-decisions.md#gate-on-merged-tree-lane-fast-fail)
already ratifies the *principle* — the binding gate runs once on the **merged** tree, citing the Not-Rocket-
Science Rule and Bors by name. Batch verification is settled doctrine here, not a proposal.

## The reframed question, for the next prep pass

> Does the measured landing-queue evidence meet #2692 clause 3's saturation trigger — and if the trigger
> cannot be evaluated because #2740 was never built, is building the tripwire the actual next move, or does
> the evidence below already discharge it?

That is a real open decision with a real fork (*build the meter* vs *rule the trigger met on existing
evidence*), and it is **not** the decision this card was filed as. It needs its own prep pass — prior art
on #2680's metric definition, and a fork set authored against clause 4's routing requirement.

## What the prep pass measured — this part stands

None of it appears in any prior ruling. Full method and per-run figures in the linked report.

- **Required-check critical path ≈ 6.2 min**, entirely inside the `test` chain — slowest `vitest` shard
  (~4.6 min, `we:.github/workflows/ci.yml:65`) plus the `needs: test-shard` aggregator (~1.6 min, `:141`).
- **`smoke` is off the critical path** in the measured (uncontended) regime — ~2.2 min (`:215`), finishing
  ~2.5 min before the `test` chain. *Caveat the skeptic raised and this card accepts:* the sample is four
  **successful, low-contention** runs; at 6 jobs per run × a p90 batch of 6 PRs, against a runner cap shared
  with `frontierui` and `plateau-app`, shards and `smoke` contend and the conclusion may invert. **Not
  re-measured under saturation.**
- **Shard imbalance** — shard 4 runs 3.2× shard 2 (276s vs 85s).
- **`check:standards` is serialized for no reason** — it has no shard dependency and sits behind them only
  through job co-location (`:200`).
- **Batch-size distribution** — 124 drain passes over 10 days: median 2, p75 4, p90 6, max 49; 65% land ≤2.
- `visual` is already `if: false` pending #2232 (`:372`); `test-selection-measure` is opt-in (`:298`).

## Withdrawn forks — what the skeptic and screen destroyed

Recorded rather than deleted: each was authored, attacked, and did not survive. None should be revived
without the reconciliation above.

**Fork 1 (was: does the batch gate replace a per-PR check?) — WITHDRAWN.**
`Skeptic: REFUTED — not a fork at all.` `#repo-drain-check-contract` declares CI job shape and required
contexts repo-private ("how a repo turns that check green … is repo-private impl"); the drain consumes only
the name `test` (`we:scripts/merge-ai-prs.mjs:2476`) and `smoke` appears zero times in it. The default also
inverted `#gate-on-merged-tree-lane-fast-fail`, which ranks the per-lane gate as best-effort fast-fail, not
binding authority. Premise separately unstable under queue saturation.
`Screen: clear` (destroyed on the skeptic axis instead).

**Fork 2 (was: where does batch verification execute?) — WITHDRAWN.**
`Skeptic: REFUTED — the code sketch did not run.` `git merge-tree --write-tree` returns a TREE; the sketch
fed it back as a commit and pushed it to a branch ref (both fail; the skeptic reproduced the errors). The
push would have triggered no workflow at all — `we:.github/workflows/ci.yml:44-49` fires only on
`push: branches: [main]` / `pull_request`. Naive stacking hits the #2198 shared-manifest wall at the item's
own median N=2. And the FUI sibling is checked out with no `ref:` (`:90-95`), so a WE batch ref is verified
against FUI *main* — it can never verify a cross-repo couple.
`Screen: clear` (destroyed on the skeptic axis instead).

**Fork 3 (was: when does `strict` flip?) — WITHDRAWN, and its premise was false.**
`Skeptic: REFUTED — "the batch run subsumes strict" is untrue.` `strict` asserts every state `main` passes
through was tested; a batch run asserts one terminal combined tree is green. The intermediate states are
never verified, and `we:.github/workflows/deploy.yml` + `we:.github/workflows/release-please.yml` fire on
each of them. Under auto-eject it is worse: green(A∪B∪C) does not imply green(A∪C), and the required check
contains genuinely non-monotone gates — `coverage:merge --threshold=80` (`:196`) and `check:standards`
(`:200`).
`Screen: clear` (destroyed on the skeptic axis instead).

**Correction of a published claim:** the draft asserted `strict: true` was an unexamined default absent from
#2152's ruling. **False — #2152 records it in three places** (its digest lists "require branches up-to-date
before merge"; its result block records `strict: true`; its verify command reads `strict` first). Flipping
it is a **reversal of a deliberate ruling**, not the correction of an oversight. The report carries the same
correction.

**Fork 4 (was: how is a red batch attributed?) — WITHDRAWN.**
`Skeptic: REFUTED — per-lane re-run cannot find the only failure class batching introduces.` Every queued PR
already has a green `test` at its own head (`we:scripts/merge-ai-prs.mjs:584`), so re-running lanes alone
re-tests things that are green by construction; a two-lane semantic interaction is invisible to it and only a
subset search finds it. Run-count (N vs log N) was the wrong axis entirely. Auto-eject is separately
forbidden for stacked lanes — `we:docs/agent/backlog-workflow.md:779` makes "salvage the tail without the
broken parent" structurally impossible, and a stacked tip contains its parent's commits.
`Screen: flagged(prio)` — the default rested on "complexity carried in the common case", a cost argument. At
zero cost the merit residue is completeness of the culprit set, not run count. Fix moot: the fork is
withdrawn on the skeptic axis.

**Citation-scope downgrades applied:** #2165 is context, not authority (its root cause was single-repo CI
failing to resolve `@frontierui/*` aliases, nothing to do with breakage landing on `main`). #2138 Fork 5
constrains placement (native queue OFF) but does not authorize an in-house batch gate — the actual governing
authority is #2692, which the draft never cited. The draft also cited `we:scripts/merge-ai-prs.mjs:586` for
the red-check refusal; that is `:584`, and `:586` is the merge-state refusal.

## Carved child — not blocked by any of this

- **#3348** — take `check:standards` and shard imbalance off the per-PR CI critical path. Repo-private CI
  shape, explicitly outside the drain contract per `#repo-drain-check-contract`, no statute conflict, and it
  is where the measured per-PR win actually is (~2–3 min). Independent of this decision entirely; it should
  proceed regardless of how the reframed question is answered.

## RULED 2026-08-26 (operator) — `strict` off; batching stays deferred

The prep pass above withdrew all four forks. Post-prep investigation then **overturned the reasoning behind
one of those withdrawals**, and the operator ruled on the corrected evidence.

### The correction that changed the call

The withdrawal of Fork 3 leaned on a claim that the drain's rebases were caused by textual conflicts on the
shared `we:.lane-manifest.json`, not by `BEHIND`. **That was wrong, twice over:**

1. **#2411 is `resolved`** — *"Move the lane-manifest off the tree into the PR body"*. Verified across 11
   consecutive lane PRs: **zero** carry the manifest in their diff. It is written to the working tree and
   never committed.
2. The classification was taken from the rebase commit **subject**, which is a **fixed template** —
   `we:scripts/lib/rebase-drop-manifest.mjs:189` always emits *"drop transient &lt;manifest&gt;"* regardless of
   what triggered the rebuild. Every rebase has announced a file that has not been there since #2411 landed.

The rebuild guard (`we:scripts/lib/rebase-drop-manifest.mjs:177-186`) skips only when the tip is **both**
not-behind **and** already manifest-free. The comment immediately above it
(`we:scripts/lib/rebase-drop-manifest.mjs:168-176`) states outright that *"a genuinely BEHIND tip has
`isAncestor === false` and still gets the real rebase"*. With the manifest condition permanently satisfied,
**every one of the 208 rebases measured over the window below fired on `BEHIND` alone** — i.e. on `strict: true`.

Measured cost over the 10 days **2026-08-16 → 2026-08-26** (window pinned below): **208** `drain: rebase`
commits on `origin/main`, **~4.5** CI runs per PR, ≈ **20.5 hours of CI** spent re-testing unchanged trees.

#### Correction to the figures above (review of PR #1611, and a second correction after it)

**Three** numbers in the first draft of this section were wrong, and one citation pointed at the wrong lines
— **four** corrections in all. They are retracted here rather than quietly overwritten.

**A second pass was then needed, and it is the more important one.** The first round of corrections replaced
the figures but measured them with a **rolling** `--since=10.days`, whose start moves with the clock. That
made the recorded numbers unreproducible: re-running the card's own stated command in-lane on
2026-08-27T00:13Z returned **151 / 153**, not the **153 / 155** the card recorded hours earlier — and the
calendar window the card *named* (`2026-08-16 → 2026-08-26`) returns **208**. The command and the stated
window disagreed by 55. A figure that cannot be re-derived from the method printed beside it is not a
measurement, so the window is now **pinned to absolute, already-closed bounds** and every figure re-derived
against it.

Window, used for every row below: **`2026-08-16T00:00:00-04:00` … `2026-08-26T00:00:00-04:00`** — ten full
calendar days, both bounds in the past, so the counts are stable rather than drifting with the clock.

| claim as first written | corrected to | how it was re-measured |
|---|---|---|
| *"167 `drain: rebase` commits in 10 days"* (stated twice), then *"**153** on `origin/main` (155 across all refs)"* | **208** on `origin/main` (**209** across all refs) | `git log origin/main --since=2026-08-16T00:00:00-04:00 --until=2026-08-26T00:00:00-04:00 --grep='^drain: rebase' \| wc -l` on a freshly fetched `origin/main` (`--all` for the all-refs figure). Both `167` and `153` are retracted: `167` was never measured, and `153` came from a rolling window that no longer reproduces. |
| *"≈ **17 hours of CI**"*, then *"≈ **15.5 hours**"* | **≈ 20.5 hours** | derived, not independent: 208 × mean CI wall-clock on `main` of **354 s** (median **353 s**, n = **154** completed successful runs created in the window, via `gh run list --workflow=CI --branch=main`) = 73 632 s. The earlier `365 s` / n = 107 came from the unpinned window. |
| *"~4.9 CI runs per PR"*, then *"~4.6"* | **~4.5** | **857** CI runs (all branches) vs **192** PRs created in the same pinned window (`gh run list --workflow=CI --limit 1500` / `gh pr list --state all --limit 1000`; both fetches reach back past the window start, so it is fully covered). |
| the rebuild-guard citation, first written as `we:scripts/lib/rebase-drop-manifest.mjs:172-176` | **`we:scripts/lib/rebase-drop-manifest.mjs:177-186`** | `172-176` is the tail of the explanatory comment; the guard code is `const curTreeOid` (`177`) through the closing brace (`186`). Re-verified in-lane this round, along with the `:168-176` comment span cited above and the `:189` commit-subject template — all three are **correct** as they now stand. |

The ruling below is unaffected: the direction and order of magnitude are identical, and `BEHIND` remains the
sole live trigger regardless of which of these counts is used. The count moved **up**, not down, so the
measured waste that motivated the ruling is larger than either earlier figure — not smaller.

### The ruling

- **`strict: false` — applied 2026-08-26** via the scoped `required_status_checks` endpoint. Required
  contexts (`test`, `smoke`), 0-approval self-merge, `enforce_admins: false` and the force-push block are all
  unchanged; a snapshot of the prior config was taken first. This **reverses the `strict: true` half of
  #2152**, deliberately and on measured evidence — #2152 ruled it, so this is a reversal, not a correction.
- **Batching stays deferred**, per `#event-driven-land-is-wake-only` clause 3. Independently confirmed by the
  #2680 conveyor instrument: the binding regime is `latency-bound` on `firstCi`, with land-serialization at
  ~20s/item against ~366s/item of first-CI. Batching optimizes a non-binding term. **Revisit when it hurts**,
  not on a schedule.
- **Recovery stays manual for now.** The auto-repair (freeze arming + drain-owned revert-to-green) is filed
  and explicitly **not started** — see below.
- **The deploy hole is closed separately.** `strict` never protected the deploy:
  `we:.github/workflows/deploy.yml` fired on push, in parallel with CI, and shipped the branch tip regardless
  of outcome. Fixed in the same batch of work.

### What the reframed question turned into

Not "which batching design" — that is ruled and deferred — but "revisit when the pain is felt." No prep pass
is owed unless that happens. If it does, the entry point is #2740's trigger and #2704's routing, not this
card.

## Spawned

- **#xmiuo0r** — deploy only a CI-verified SHA (`workflow_run` + `head_sha` + re-derive the verdict).
  Delivered alongside this ruling.
- **#xd6hbxe** — pin the FUI sibling ref so a deploy is reproducible.
- **#xmit46t** — stamp the deployed SHA into the Worker; settle the rollback path.
- **#xu9c4q4** — arm the red-main stop-the-line. **Deferred by the operator**: recover manually until it hurts.
- **#3348** — take `check:standards` and shard imbalance off the per-PR critical path (attacks `firstCi`, the
  binding term).

## Done when

1. **Executable** — `gh api repos/:owner/:repo/branches/main/protection --jq .required_status_checks.strict`
   returns `false`. ✅ verified 2026-08-26.
