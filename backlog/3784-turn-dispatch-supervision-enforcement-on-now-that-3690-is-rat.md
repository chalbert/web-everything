---
bornAs: x784irf
kind: story
size: 8
parent: "3383"
status: resolved
blockedBy: ["3850", "3840", "3848", "3838", "3845", "3846", "3888", "3889", "3887"]
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/lib/dispatch-supervision-promotions.json", "we:scripts/conveyor/log-delegation-trial.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
graduatedTo: none
relatedTo: ["3690", "3717", "3783", "3801", "3843", "3850"]
tags: [dispatch, delegation, supervision, graduation]
---

# Turn dispatch supervision enforcement on now that #3690 is ratified

#3690 is ratified (we:docs/agent/platform-decisions.md#delegation-trial-record-graduation), and the dispatch supervision gate built by #3717 still sits behind WE_DISPATCH_SUPERVISION_ENFORCE, off by default, so the computed supervision level is recorded but never enforced. Design-first: settle what the gate must check under the ratified rules (operator-gated promotion, the informative field, the post-miss bar, the never-absent independent pass) before the default flips, then flip it.

**Design settled 2026-09-22 — see `## Design settled (2026-09-22)` below.** This card now also carries rule 6
(the ratified promotion record) plus the flip itself; rules 4, 5 and 7 are three children under #3383 that this
card is `blockedBy`. Still deliberately **not cleared for the conveyor**: it is `blockedBy` nine items and the
flip is the last step of the whole family, so a human or session clears it (the `add` command of
we:scripts/conveyor/queue.mjs) once those land.

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

## Design settled (2026-09-22)

All four questions below are settled; the section is kept as filed so the reasoning can be read against what
was asked. Questions 1 and 4 were answered by the operator directly; questions 2 and 3 were settled in an
Opus design session on 2026-09-22 against the code on `origin/lane/mechanical-dispatcher`. **This card is no
longer design-first** — the `design-first` tag is dropped and the work below is buildable once the
`blockedBy` children land.

### 1. Order — build rules 4 to 7 first, THEN flip the default

Operator, 2026-09-22, on whether to build the rules first or flip first: *"seems we should implement them all
right"*. Settled: build. Flipping first is fail-safe in the narrow sense that it holds more and never less,
but its `spot-check` answer would still come from automatic promotion, which rule 6 forbids — so the flip
would put a forbidden behaviour into force in order to enforce a ratified one. The flip is the last step.

### 2. Promotion record — a ratified decision card is the ACT, a checked-in JSON file is its machine-readable transcript

**The act is a decision card ratified into we:docs/agent/platform-decisions.md.** That is what "ratified"
means in this repo (the statute layer), and it is the form every act in this family already took: #3690,
#3801 and #3850 are all decision cards with a `## Ruling`, two of the three codified at an anchor. Rule 6's
"done in batches against accumulated data" is exactly a decision card's grain: one act names many triples.

**The lookup is a new checked-in file, `we:scripts/lib/dispatch-supervision-promotions.json`**, built to the
shape #3843 and `decideDispatchRoute` already use for the size policy, so this adds a second instance of an
existing pattern rather than a new one:

- read at the io edge by a `defaultReadPromotions` sitting beside `defaultReadSizePolicy`
  (we:scripts/operations/dispatch-lane-io.mjs:429), handed across as data — the pure library never reads a
  file;
- validated by a pure `validatePromotions` beside `validateSizePolicy` (we:scripts/lib/dispatch-contracts.mjs:784);
- injected as a `promotions` dep on `decideDispatchRoute` (we:scripts/lib/dispatch-contracts.mjs:985),
  alongside `scorecards` and `sizePolicy`.

**Each row carries the citation to its own act**, so the record is auditable rather than merely trusted:
`{provider, model, taskType, level, ratifiedOn, ratifiedBy: "#NNNN", anchor: "we:docs/agent/platform-decisions.md#…"}`.
A row whose `anchor` does not resolve to a real heading, or whose `ratifiedBy` card is not `status: resolved`,
is invalid. That check is script-decidable, so it belongs in `check:standards`, not in a reviewer's head.

**It fails CLOSED, and this is the one deliberate departure from the size-policy precedent**, which fails open
to its defaults (we:scripts/operations/dispatch-lane-io.mjs:422-424). A missing, unparseable or invalid
promotions file promotes nothing, so every triple stays `full`. That is rule 6's own stated default — "With no
such act, a triple stays at `full`" — and it is the safe direction: a broken read that silently promoted would
be the exact failure the record exists to prevent.

**The gate stays a pure function plus a lookup, and `selectSupervisionLevel` is NOT touched.** It keeps
computing the evidence verdict from the trial record alone, because rule 1 binds both consumers of that record
to the same predicates and a promotion is not a predicate on the record — it is an authorization. So the clamp
lives one layer up, in `decideDispatchRoute`: a computed `spot-check` survives only when the triple is named in
the promotion record, and otherwise records `full` with a reason naming the missing act. A computed `full` is
never lifted by anything. Demotion therefore stays automatic and immediate (the data demotes) while promotion
never happens without a named, cited row (the operator promotes) — rule 6 in one expression.

**Rejected — a field on the scorecards store.** we:scripts/conveyor/log-delegation-trial.mjs writes those rows
mechanically at the end of every trial, so a promotion living there would be written by the same path it
authorizes. Rule 2 is explicit that authority is never earned by the record, and #agent-vendor-registry rule 3
names the same shape (self-certification) as the reason a descriptor may not declare its own supervision level.

**Rejected — a decision card per triple with no machine-readable index.** Not because a decision card is too
heavy (#3690 was one), but because the gate cannot read prose, and "done in batches" makes per-triple cards the
wrong grain. The decision card survives as the act; the JSON is its transcript, and the `ratifiedBy` + `anchor`
fields are what keep the transcript honest.

### 3. Scope — rules 4, 5 and 7 are carved into three children under #3383; rule 6 stays on this card

Split, following how the #3801 ruling carved its children: onto the family's umbrella epic with `blockedBy`
edges back, not onto the ruling card itself. The three new children are `parent: "3383"` and this card is
`blockedBy` all three.

- **Rule 4** — a trial is informative only by its own recorded field (`3888`). Touches the row schema in
  we:scripts/conveyor/log-delegation-trial.mjs and the predicate `isInformativeRecord`
  (we:scripts/lib/provider-routing.mjs:256), which today infers it from `outcome ∈ {rejected, reworked}` plus a
  non-empty `findings`.
- **Rule 5** — a `rootCause` field, then a post-miss bar of `minCleanStreak + k` (`3889`, `blockedBy`
  `3888`).
- **Rule 7 at `spot-check`** — the independent pass gets shallower, never absent (`3887`). #3850 (ratified
  2026-09-22) already settled the `full` half: the supervisor is the review panel on the lane's own PR, held at
  the land seam. Only the `spot-check` depth is left, and it lands in the review/jury files, not in dispatch.

**The decisive reason to split rather than fold: rule 5 contradicts this card's own acceptance criterion.**
Done-when 3 below requires `DEFAULT_BACKDOWN_THRESHOLDS` (we:scripts/lib/provider-routing.mjs:144) to be
unchanged by this card's diff; rule 5 requires adding `k` to exactly that object. Folded in, this card could not
pass its own test. Rules 4 and 7 are then split on the ordinary grounds — different files, independently
deliverable, and rule 7 is not even in the dispatch path.

**Rule 6 is NOT carved out, and that is a deliberate exception to the split.** This card *is* the gate card:
its Done-when 1 already asserts rule 6's behaviour verbatim ("a triple whose computed level is `spot-check` but
which is not named in the ratified promotion record is gated as `full`"), and #3843's card already names "#3784's
rule-3 and rule-6 fixes" as what removes its `defaultSize < 13` refusal. A rule-6 card separate from the flip
would be inert on its own — nothing reads the promotion record until the gate is on — and the opposite order is
forbidden, so the split would buy no schedule and cost one more seam. This card grows from size 5 to 8 to carry it.

**Build order** (a file dependency, not three independent cards): `3888` (rule 4) → `3889` (rule 5);
`3887` (rule 7) in parallel with either; then this card — promotion record, then the flip, then the wording
fix below.

### 4. Which branch — `lane/mechanical-dispatcher` first

Operator, 2026-09-22: *"lane/mechanical-dispatcher first"*. Matches every sibling in this family. The code home
is the prototype branch — commit straight to it, no PR, one tracker note on #3383 per push; it reaches `main`
through #3443. (This card's own file lives on `main` and is edited there by the normal lane-clone PR route.)

## DESIGN TO SETTLE

*(Settled 2026-09-22 — see the section above. Kept as filed.)*

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
4. **Executable (rule 6, the promotion record)** — on the branch, `test -f we:scripts/lib/dispatch-supervision-promotions.json`
   succeeds and the file parses as JSON (it does not exist today), and
   `npx vitest run we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs` passes with new cases that fail
   before: (a) a missing, unparseable or invalid promotions file promotes nothing and every route records
   `full` — it fails CLOSED, unlike the size policy; (b) a computed `spot-check` for a triple named in a valid
   row records `spot-check`; (c) the same computed `spot-check` for a triple NOT named records `full`, with a
   reason naming the missing ratified act; (d) a computed `full` for a triple that IS named still records
   `full` — a promotion never lifts a demotion; (e) a row missing `ratifiedBy` or `anchor` is refused by name.
5. **Executable (rule 6, the citation is checked, not trusted)** — `npm run check:standards` fails on a
   promotions row whose `anchor` names no heading in we:docs/agent/platform-decisions.md or whose `ratifiedBy`
   card is not `status: resolved`, and passes on the checked-in file.
6. **Observable (rule 6, purity)** — `selectSupervisionLevel` in we:scripts/lib/provider-routing.mjs is
   unchanged by this item's diff: the promotion clamp lives in `decideDispatchRoute`, and the file read lives in
   we:scripts/operations/dispatch-lane-io.mjs.
7. **Observable** — the checked-in promotions file ships **empty** (`{"promotions": []}`). No triple is promoted
   by this card; every route is `full` on the day the switch flips, and the first real promotion is a separate
   ratified act.
8. **Executable (#3843's carried constraint)** — the `defaultSize < 13` refusal that #3843's loader raises with
   a reason naming this card is removed, and a test that asserted it is updated in the same diff.

> **Verified done, 2026-09-23.** Built and committed to `lane/mechanical-dispatcher` at `4f357472d`
> (tracker note `346d625da`). All 8 Done-when criteria met and tested. Full `npm run test:unit`:
> 16,503 passed, 2 pre-existing failures unchanged (confirmed via `git stash`). `check:standards`:
> 2 pre-existing unrelated errors, 0 added.
>
> **Real gap found and fixed within this card's own scope:** verifying that #3850 actually prevents
> enforcement from freezing the dispatcher, found #3850 was ratified but its code was never built —
> `record.supervisor` was never set anywhere, so flipping enforcement would have held every
> `full`-supervision dispatch at spawn. Confirmed empirically (existing build/fix/ci-heal tests failed
> `dispatching: false` the moment the default flipped) before fixing it. Implemented #3850 Fork 1 as
> ratified: every routed record now names a supervisor (the land-seam PR review), so a well-formed
> dispatch is never held at spawn. **#3850 Fork 2 (forcing `review:pending`/a merge hold on delegated
> routes) remains unbuilt** — filed separately (bornAs `x2h4jmq`), since it was never tracked as its
> own item before.
>
> Resolved here as `graduatedTo: none` — the code is not yet on `main`; it reaches `main` through
> #3443.
