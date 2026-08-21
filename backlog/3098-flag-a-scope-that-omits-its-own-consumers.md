---
bornAs: x6cdlmu
kind: story
size: 3
parent: 3099
status: open
dateOpened: "2026-08-13"
tags: [delivery, backlog, readiness, preparation]
---

# Flag a scope that omits its own consumers

> **ATTEMPTED AND STOOD DOWN, 2026-08-13. The import graph is the wrong graph for this repo.** Built,
> reviewed twice, and dropped on the second review's recommendation. The script is deleted; this card keeps
> the finding, because the finding is worth more than the code was.

The idea: given an item's `scope:`, find every module that imports a file in it and report any importer the
scope does not cover. Two of the three surveyed items looked like that shape, and it is mechanical.

## No `scope:`, deliberately

Two of the three files this card used to scope are deleted by this PR (`we:scripts/check-readiness.mjs`, the
third, is alive on `main` and untouched — an independent review caught that overstatement). Leaving the
block would still be a dangling scope —
naming paths that do not exist, which is the defect this repo's citation gate catches elsewhere. Removing it
also puts the item in the state that is TRUE of it: `unshaped-no-scope`, which is what the dispatcher should
think, because the next attempt has a modelling question to settle before anything can be scoped at all.

## Why it was stood down

**The foundation is wrong, and it was discovered by using it rather than by reasoning about it.** Preparing
[#2996] turned up that `we:scripts/lane-pool.mjs` has more than ten consumers and **not one of them is an ES
import** — every one spawns it as a subprocess. (The first version of this paragraph named five and two of
them were wrong: the reference in `we:scripts/backlog.mjs` is a help string and the ones in
`we:scripts/verify-lane.mjs` are comments. An independent review caught that. The aggregate claim
reproduces; the hand-picked list was sloppy, which is its own small instance of the same disease.) Every one shells it as a subprocess (`node` + the path) rather than importing it. A static ESM import scan finds
zero. In a repo whose scripts overwhelmingly invoke each other as subprocesses, the import graph is simply
not the consumer graph.

Everything the reviews found follows from that:

- **The confident all-clear was baseless 74% of the time it was emitted** — 54 of 73 all-clears over the 176
  open/active scoped items. A file whose consumers all shell it reads as clean, and the output cannot
  distinguish *"looked, found nothing"* from *"never looked."*
- **It could not tell [#3090] from [#3071].** Read through the loader their real scopes are identical, so no
  version of the check can catch one and stay silent on the other. Round 1's fixtures claimed otherwise only
  because they were hand-edited.
- **It would not have shortened [#3090].** Rounds 2–4 there were reasoning defects inside a file already in
  scope.
- Round 2 closed **0 of 12** of round 1's still-applicable surviving mutations, which is the
  non-convergence signal in `we:docs/agent/delivery-loop.md` rather than a to-do list.

## What survives, and it is the valuable half

The evidence in [#3099] — now **three** items measured against what their PRs actually had to touch, after
one row was retracted as false. The omission gaps 1 and 2 name are real and each hold in 2 of 3. **The
ranking does NOT survive intact**: gap 3 fell to 1 of 3, so the epic's slice order is no longer evidenced.
The omission is real; the *detector* was wrong; and the ranking is weaker than the first version of this
sentence claimed.

## What the next attempt must settle BEFORE any code

A modelling question, not an implementation one. Iterating the implementation is exactly what failed:

- **Name the consumer relation.** In this repo it is at least: ES import, subprocess invocation, hook
  registration, npm script, and dynamic registry lookup. A checker that models one of five and reports
  confidently on the rest is worse than nothing.
- **Decide what an unscannable scope entry may conclude.** *Clean* and *unscannable* must not print the same
  sentence. That distinction, not the scan, is the hard part.
- **Say what a positive is worth.** It surfaces a question it cannot adjudicate. If it cannot rank by
  likely-importance, a hundred-item board is noise — measured: median 7 uncovered importers, p90 22, max 44.

## Retained by hand until then

At prepare time, for every file being scoped: grep for ES importers AND for subprocess callers, and decide
each deliberately. That is now the standing discipline (see the story-preparation checklist in agent
memory), and it needs no module, no blind-spot registry and no suite.

## Design — what the next attempt should NOT rebuild

**The coverage half is already solved and must be reused, not re-derived.** `we:scripts/readiness/scope-lease.mjs`
exports `coversFile(pattern, file)` — the granularity-aware matcher (#2679: a declared subtree covers what is
under it; a declared file covers only itself) — plus `scopeLease(predicted, observed)` and `breachOf`, which
express "observed files covered by NO declared entry". `we:scripts/readiness/scope-reconcile.mjs` is the
worked precedent for composing them and states the rule explicitly: *"COMPOSES, NEVER REINVENTS … This module
writes NO new coverage matcher."* A predictive consumer-omission check is the same shape with a different
input set, so the only genuinely new thing it needs is **the consumer set** — which is exactly the modelling
question above, and exactly what the stood-down attempt got wrong.

**Note what already exists in the retrospective direction, because it bounds the value here.**
`scopeLease` / `breachOf` already catch an omission *after* the lane runs, from observed touches — with no
consumer model at all, because the observation IS the ground truth. This item is only worth building if
catching the omission *before* dispatch is worth more than catching it at build time, and that comparison
was never made. Make it before writing code: if the retrospective breach already ends the same lane at the
same cost, there is nothing here.

**The measured base rates from the stood-down attempt are the yardstick for any successor**, and a new
attempt that does not beat them has not answered the objection: 73 all-clears over 176 open/active scoped
items, of which **54 (74%)** were baseless — emitted for files whose consumers all shell them; and for the
positives, median **7** uncovered importers, p90 **22**, max **44**.

## Done when

- **No tier-1 criterion, and this is the exemption:** this card is currently a *modelling* item, not a build.
  Its own body records that iterating the implementation is what failed, and the three questions under *What
  the next attempt must settle BEFORE any code* are design judgment with no command that can adjudicate
  them. A tier-1 becomes authorable only once the consumer relation is named; until then, inventing one here
  would be the same premature-implementation move this card stood down from.
- The consumer relation is written down — every relation in this repo that makes file B depend on file A
  (at minimum: ES import, subprocess invocation, hook registration, npm script, dynamic registry lookup),
  each with the evidence a scan could use for it, and each marked scannable or not. This lives on the card
  or in a report linked from it, not in a PR description.
- The clean-vs-unscannable distinction is specified as two different output sentences, with the rule for
  which one an entry gets. A specification that lets a file whose consumers are all unscannable print the
  same thing as a file with genuinely no consumers has not settled the question.
- The build-vs-drop call is recorded with the comparison against the already-shipped retrospective breach
  (`scopeLease` / `breachOf` in `we:scripts/readiness/scope-lease.mjs`) — what a pre-dispatch catch buys
  over a build-time one. "Drop it permanently" is an acceptable outcome and should be recorded as such
  rather than left open.
- If it is built, it reuses `coversFile` and adds no second coverage matcher, and it beats the 74% baseless
  all-clear rate on the same 176-item corpus — measured, on the same corpus, not asserted.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion, ahead of implementation) — The card's central claim — we:scripts/lane-pool.mjs has 10+ consumers with zero ES imports, all subprocess spawns — was independently reverified against the live repo (grep across we:scripts/**/*.mjs) and holds; the card also documents its own prior premise errors (the five-item consumer list, the #3084 fake import edge, the manufactured #3071 fixture) and how each was caught.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — This is the card's subject matter: it correctly states we:scripts/backlog.mjs's lane-pool reference is a help string and we:scripts/verify-lane.mjs's is a comment (both reverified against the live files), and generalizes to a five-relation consumer taxonomy (ES import, subprocess, hook, npm script, dynamic registry) for the next attempt to model.
- **population** (addressed; strategy: name the population each threshold guards) — The 74%/54-of-73 baseless-all-clear statistic is explicitly tied to a named population (176 open/active scoped items), and the card requires any successor to be measured 'on the same 176-item corpus' rather than a new, uncomparable sample.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card measures before recommending: 74% baseless all-clears, median/p90/max uncovered-importer counts, and 0-of-12 mutation convergence in round 2, and it requires the next attempt to weigh pre-dispatch value against the already-shipped retrospective breach (we:scripts/readiness/scope-lease.mjs breachOf) before building anything.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card names the exact failure mode this repo's stood-down check exhibited — 'the output cannot distinguish looked, found nothing from never looked' — and makes 'clean vs unscannable must print two different sentences' a Done-when requirement for any successor.

**Corrections recommended:**

- none — the preparation held up as written.

Every checkable citation and claim in the card (we:scripts/lane-pool.mjs's consumer graph, we:scripts/readiness/scope-lease.mjs and we:scripts/readiness/scope-reconcile.mjs exports and COMPOSES-NEVER-REINVENTS text, we:docs/agent/delivery-loop.md's non-convergence rule, we:docs/agent/backlog-workflow.md's tier-1 exemption clause, and cross-references to backlog 3099's retracted-row and 2-of-3/1-of-3 gap numbers) reverifies true against the live repo, and the card's own history of self-correcting prior mistakes (the five-item list, the #3084 fixture, the #3071 fixture) is itself borne out by the commit log.

_Recorded through the declared `review-prep` operation._
