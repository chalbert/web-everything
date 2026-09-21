---
bornAs: x784irf
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["3850", "3840", "3848", "3838", "3845", "3846"]
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/conveyor/log-delegation-trial.mjs"]
dateOpened: "2026-09-21"
relatedTo: ["3690", "3717", "3783", "3801"]
tags: [dispatch, delegation, supervision, graduation, design-first]
---

# Turn dispatch supervision enforcement on now that #3690 is ratified

#3690 is ratified (we:docs/agent/platform-decisions.md#delegation-trial-record-graduation), and the dispatch supervision gate built by #3717 still sits behind WE_DISPATCH_SUPERVISION_ENFORCE, off by default, so the computed supervision level is recorded but never enforced. Design-first: settle what the gate must check under the ratified rules (operator-gated promotion, the informative field, the post-miss bar, the never-absent independent pass) before the default flips, then flip it.

**Design-first and deliberately not cleared for the conveyor.** Settle the design section below on this card
first; only then clear it (the `add` command of we:scripts/conveyor/queue.mjs).

## FOUND (2026-09-21)

- **The switch.** `SUPERVISION_ENFORCEMENT_ENV = 'WE_DISPATCH_SUPERVISION_ENFORCE'` and
  `supervisionEnforcementFrom(env)` in we:scripts/lib/dispatch-contracts.mjs. Empty means off; `1/true/on`
  and `0/false/off` are accepted; any other value throws. `supervisionHold(routing, { enforce })` returns
  `null` whenever `enforce` is off. we:scripts/operations/dispatch-lane.mjs refuses a spawn only when the
  route carries a `supervisionHold`.
- **Where it lives.** All of the above exists only on `origin/lane/mechanical-dispatcher` (epic #3383). On
  `main`, we:scripts/lib/dispatch-contracts.mjs does not exist and nothing reads the env var. Turning it on
  for real therefore also waits on that branch reaching `main` (#3443), or on landing the gate there first.
- **Default-off state, and its stated reason.** The code comments give the reason as "#3690 is an OPEN,
  unratified decision", and the error and hold messages repeat "(#3690 is not ratified)". Those reasons are
  now false and must be reworded whether or not the default flips.
- **What the gate checks today is narrower than the ratified rules.** With enforcement on, it holds only a
  dispatch whose computed level is `full` and which names no supervisor. It knows nothing about who
  *promoted* a triple: `selectSupervisionLevel` in we:scripts/lib/provider-routing.mjs promotes on the data
  alone, the instant the streak is met.
- **What the ratified shape says about N.** Rule 3 of the anchor: the bar is a shape (clean streak + a
  positive control + a clean most recent verified trial, with a hard veto on a miss, per
  `{provider, model, taskType}`). N is the `minCleanStreak` field of `DEFAULT_BACKDOWN_THRESHOLDS`
  (we:scripts/lib/provider-routing.mjs, currently `{minCleanStreak: 5, requireInformativeTrial: true}`),
  a config default set only by an ordinary batched finding against real data. **This item does not change
  N or any other threshold value.**
- **Ratified rules the code does not implement yet** (from the anchor): rule 4, a separate `informative`
  field on the trial row (the code infers it from `outcome ∈ {rejected, reworked}`); rule 5, a root-cause
  note field and a post-miss bar of `minCleanStreak + k` (the code re-promotes on the same streak); rule 6,
  promotion only by an explicit ratified act naming the triples (the code promotes automatically); rule 7,
  an independent pass at every level, only shallower at `spot-check`.

## DESIGN TO SETTLE

1. **Order.** Flip the default only after rules 4–6 are built, or flip it now with the gate still holding
   only unsupervised `full` routes? Flipping now holds more, never less, so it is fail-safe; but its
   `spot-check` answer would still come from automatic promotion, which rule 6 forbids.
2. **Promotion record.** Where the "explicit ratified act naming the triples" lives (a checked-in list, a
   field on the scorecards store, a decision card), and how the gate reads it while staying a pure function
   plus a lookup.
3. **Scope of this item versus children.** Rules 4, 5 and 7 each touch different files. Decide whether each
   is carved into its own child story under #3383 with a `blockedBy` edge from this one, or folded in here.
4. **Which branch lands it.** `main` (after #3443) or `lane/mechanical-dispatcher` first.

## Finding (2026-09-21): the exact lines that still say "not ratified"

A scan of scripts/, skills-src/ and docs/ on `origin/lane/mechanical-dispatcher` for `#3690` next to "not ratified" or "unratified" finds four places, all prose or error text, none on main:

- we:scripts/lib/dispatch-contracts.mjs, the docblock: "#3690 is an OPEN, unratified decision (worker `prepare-3690` is preparing it)".
- we:scripts/lib/dispatch-contracts.mjs, the error text for a bad enforcement value: "#3690 is not ratified, so supervision is RECORDED, not enforced".
- we:scripts/lib/dispatch-contracts.mjs, the hold message: "(#3690 is not ratified)".
- we:scripts/operations/dispatch-lane.mjs, the comment above the supervision gate: "the graduation model it implements (#3690) is not ratified".

The two message strings are user-visible, so a test may assert them; reword them together with any test that does. The separate header claim in we:scripts/lib/provider-routing.mjs (it says the router serves interactive sessions, against the ratified Reach rule) is a different correction and is tracked on card 3798, not here.

## Finding (2026-09-21, from the #3801 prep): enforcement as built would hold every code-change dispatch

- `supervisionHold` (we:scripts/lib/dispatch-contracts.mjs on `origin/lane/mechanical-dispatcher`, lines 714 to 721) holds a `full` route that names no `supervisor`, and `decideDispatchRoute` never sets a `supervisor` field. Every code-change route is `full` today. So with `WE_DISPATCH_SUPERVISION_ENFORCE=1` every `build`, `fix` and `ci-heal` dispatch is held; the #3801 prep reproduced it on a size-2 `build`.
- So this card's design must also settle what satisfies a `full` route for a single-worker lane (for example, rule 7's independent pass at the pull request), before the default flips. #3801 delegates that question here. *(2026-09-21: that question is now its own prepared decision card, `3850`, and this card is `blockedBy` it. It is also `blockedBy` the #3717 children that the #3801 ruling orders before this card: the override and `executed` fixes, Fork 2 and both Fork 3 slices.)*
- Once the branch catches up with `main` (#3804), `main`'s 26 delegation trials arrive, and the dispatch path then records `spot-check` for `codex|gpt-6-astra|bugfix` and `antigravity|gemini-3.8-flash-low|conflict-resolution`. Those `spot-check` values come from the dispatch path's placeholder risk thresholds, not the router's defaults: `thresholdsForRisk` (we:scripts/lib/dispatch-thresholds.mjs on the branch, lines 9 to 13) gives a low-risk dispatch a streak of 2 and no positive control, against rule 3's bar (the router's own defaults return `full` for both triples). That is the rule-3 and rule-6 gap becoming visible in real records, so this card should land before or with that catch-up, and should settle whether the per-risk table survives at all.

## Done when

1. **Executable** — a test in the dispatch-contracts suite asserts that `supervisionEnforcementFrom({})`
   returns `true` (fails today: it returns `false`), and that a triple whose computed level is `spot-check`
   but which is not named in the ratified promotion record is gated as `full`.
2. **Executable** — `npm run check:standards` reports 0 errors, and a grep of we:scripts/ for
   `not ratified` / `unratified` next to `#3690` returns nothing.
3. **Observable** — `DEFAULT_BACKDOWN_THRESHOLDS` in we:scripts/lib/provider-routing.mjs is unchanged by
   this item's diff.
