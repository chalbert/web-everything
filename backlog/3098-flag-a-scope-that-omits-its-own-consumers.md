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
