---
bornAs: xaevzg4
kind: story
size: 3
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-27"
graduatedTo: none
relatedTo: ["3319"]
scope:
  - we:scripts/review-corpus/gates.mjs
  - we:scripts/review-corpus/__tests__/gates.test.mjs
tags: [review, gates, backlog-hygiene, replay-harness]
---

# The vacuous-criterion gate models one shape of vacuity and misses the common one

`vacuousExecutableCriterion` already runs against backlog cards. It missed a real vacuous criterion because its detector only recognises criteria demanding a literal be ABSENT; the criterion that got through was a test-runner filter selecting zero tests, which is a different shape and far more common.

## What this card first claimed, and why that was wrong

The first version of this card said the eight gates "score a corpus of past reviews and never run against a
backlog card", and concluded *"a detector pointed only backwards catches nobody."* **Both halves are false**,
and a reviewer refuted them by reading the code:

`we:scripts/review-corpus/gates.mjs` opens `vacuousExecutableCriterion` with

```js
if (!/^backlog\//.test(path || '') || typeof read !== 'function') return [];
```

(`we:scripts/review-corpus/gates.mjs:270`), and its registry entry reads
`{ name: 'vacuous-executable-criterion', fn: vacuousExecutableCriterion, targets: 'backlog card' }`.
Backlog cards are the **only** thing it runs against. Re-verified
here by calling the gate as the registry does — `fn(text, { path, read })` — over both revisions of the #3319
card, the one carrying the vacuous criterion and the one that fixed it, with a `read` resolving files at that
same revision: **both return `[]`**. `runGates` over the whole eight-gate registry finds nothing on either
revision. So the failure was never about direction.

## The real gap

The detector recognises exactly one shape of vacuity:

```js
const demandsAbsence = /returns? \*{0,2}zero\*{0,2} hits|\bis gone\b|\bno longer (?:appears|occurs)\b|returns? nothing/i.test(crit.text);
if (!demandsAbsence) continue;
```

That models *"prove this literal is gone from that file"* — it then reads the file and reports the criterion as
vacuous if the literal already matches zero times. Good gate, narrow aperture.

The criterion that got through on [#3319](/backlog/3319/) was, verbatim:

```
1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-pr.test.mjs -t "#3319"` (drop the
   `we:` prefix when actually running it). Fails before this item lands — no `judgeSecurity` step exists and
   the run reaches `confirm` after ONE judge suspend — and passes after.
```

It is vacuous for a different reason: a `-t` filter matching nothing is a **selection of zero**, and vitest
treats an empty selection as success, exiting **0** with everything reported as skipped. Nothing in the text
"demands absence", so `demandsAbsence` is false and the gate returns before it looks at anything.

**Pointing the gate forward closes nothing, because it already points forward.** Widening the aperture is the
work.

## What to build

Teach the detector the **empty-selection** shape, which is the one that actually recurs here: a criterion whose
command is a test-runner invocation with a filter (`-t`, `--testNamePattern`, a path glob) that selects no
tests at the current revision. That is checkable without running anything — resolve the filter against the
suite and count matches.

Worth considering alongside it, in rough order of how often they appear:

- A criterion that runs a command but asserts nothing about its output, where the command exits 0 on an empty
  or skipped result (the general case of the above).
- A criterion naming a file that does not exist yet, which some runners treat as success.

Deliberately **not** in scope: running the criterion. A gate that shells out to vitest per card is a different
cost class and a different failure mode.

### The predicate, stated concretely

A criterion whose command is a **test-runner invocation under a name/path filter** is vacuous unless it also
asserts that tests *ran*. Detect the filter form (`vitest … -t`, `--testNamePattern`, a `run <path>` that
resolves to no file) with **no downstream assertion of a non-zero pass count**. The shape #3319 landed as its
own fix — `| grep -qE "Tests +[0-9]+ passed"` — is exactly that missing assertion, so it doubles as the
positive example the detector should let through.

**Keep the existing absence detector.** This is a second predicate beside it, not a replacement.

### The general principle, which belongs in the gate's own doc comment

More shapes will follow, so write down the rule they are all instances of: **a criterion is vacuous when its
success is independent of the work.** "The literal is already missing" and "the selection is already empty" are
two instances of that, not the whole set. Naming the rule in the gate's header is what stops the next shape
being filed as a third unrelated card.

## The claim worth keeping

The retracted framing had one true observation buried in a wrong diagnosis: **a gate is only as good as the
shape it models, and the shape it models is invisible from its name.** `vacuous-executable-criterion` sounds
like it covers vacuous executable criteria; it covers one species of them. The replay harness scores a gate's
precision against past reviews — it cannot tell you what the gate never looks at. Recall against a corpus of
*known* labels says nothing about the defects nobody labelled.

## Done when

1. **Executable** — running the gate registry over a card body carrying the criterion quoted verbatim above
   reports it, and running it over a fixed criterion (one whose filter selects a test that exists) reports
   nothing. Both directions: the gate returns `[]` on that input today — verified here against both revisions
   of the #3319 card — so a change that does not flip it has not closed the gap.

   The fixture is the quoted text itself, not a revision: the two commits that introduced and then fixed that
   criterion never landed on `main`, so citing them by sha would leave whoever builds this with a reference
   that does not resolve.
2. **Executable — pinned as a case.** A case in `we:scripts/review-corpus/__tests__/gates.test.mjs` feeds
   `vacuousExecutableCriterion` the #3319 pre-fix criterion text and asserts **exactly one** finding of gate
   `vacuous-executable-criterion`. It returns `[]` today, so the case fails before and passes after.
3. `npm run check:standards` — 0 errors.

## The near miss: this defect was filed twice, one second apart

**#3346 (`bornAs: 3346`) is the same defect as this card (`bornAs: 3340`), and is resolved as a duplicate
pointing here.** Recorded on the survivor, because the duplicate is the file nobody opens again.

Both cards were authored within one second of each other on 2026-08-26 — `3340` at `15:44:52 -0400`
(commit `3dcd4e7f`, *"backlog: file three gaps the review build surfaced"*, later rebased to `f8ac22a4`) and
`3346` at `15:44:53 -0400` (commit `11ec560a`, *"backlog/3319: retract the wrong gate diagnosis, and
actually file the gap"*, landed in PR #1585). Two sessions, working the same review-build fallout, each
independently noticed that `vacuousExecutableCriterion` models only the absence shape, and each filed it.

The #3319 session's own PR body records the search it ran before filing: *"Grepped `backlog/` for
`vacuous-executable-criterion`, `vacuousExecutableCriterion` and `pointed only backwards`; the only hit was
#3319 itself."* **That search was correct and its conclusion was still wrong** — `3340` had been filed
sixty seconds earlier and had not landed, so it was not in any checkout to be grepped. A hash-named card is
unresolvable **by design** between filing and land. `grep` finding nothing is the *expected* state for a real
card, and it is indistinguishable from the state for a card that never existed.

This is the second time today the same gap produced a duplicate; #3327/#3328 is the first, and its write-up
states the same two corrections:

1. Treat *"I cannot find this id"* as **unknown**, never as **absent**.
2. Check `origin/main`, not the working checkout — and even then, expect a lag.

Neither correction would have helped here, because the search was for a *topic*, not an id, and no id existed
to check. The machine-checkable half is different in this case: nothing warns an author that a card being
filed **restates a card already in flight**. `duplicateBornAs` (`we:scripts/check-standards-rules.mjs`) groups
by identical `bornAs`, so it never fires on two hashes describing one defect. That is the gap — one defect
filed twice, under two hashes, and no check sees it.

### Which card survives, and on what basis

**The one filed FIRST survives, not the better-written one.** #3346 has the tighter digest and the more
concrete predicate; this card has the longer evidence trail. That is not the tiebreak. Commits, PR bodies and
prose citations already point at whichever card landed first, and picking on quality means rewriting those
citations — which is precisely the move that produced the #3327/#3328 duplicate in the first place. So:
earliest filing time wins, corroborated here by land order and by number order (#3340 was numbered at
`17:13:42`, #3346 at `17:40:38`).

Everything #3346 carried that this card lacked has been folded in above: the registry-entry evidence, the
concrete `grep -qE "Tests +[0-9]+ passed"` predicate, the *"second predicate, not a replacement"* constraint,
the general principle for the gate's doc comment, the `we:scripts/review-corpus/__tests__/gates.test.mjs`
criterion, and its `relatedTo` / `scope` / `tags` frontmatter. Its one non-portable detail — a citation of
commit `d2f8b77a` — was deliberately **not** folded in: that commit is not on `origin/main`, so the reference
does not resolve for anyone reading this card.
