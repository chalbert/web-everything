---
bornAs: xaevzg4
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/review-corpus/gates.mjs
tags: []
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

(`we:scripts/review-corpus/gates.mjs:270`.) Backlog cards are the **only** thing it runs against. Re-verified
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
2. `npm run check:standards` — 0 errors.
