---
bornAs: xac2c78
kind: story
size: 2
parent: "3318"
relatedTo: ["3319"]
scope: ["we:scripts/review-corpus/gates.mjs", "we:scripts/review-corpus/__tests__/gates.test.mjs"]
status: open
dateOpened: "2026-08-26"
tags: [review, gates, backlog-hygiene, replay-harness]
---

# `vacuous-executable-criterion` only models absence, so an empty test selection passes it

The gate models exactly one shape of a vacuous "Executable" criterion — one demanding that a named literal be
**absent** from a file it already never occurs in. A criterion that runs a *command* which trivially succeeds
because it **selected nothing** is a second, equally common shape, and the gate is blind to it. #3319 shipped
that exact defect past the gate.

## The evidence: it ran, and it found nothing

`vacuousExecutableCriterion` in [we:scripts/review-corpus/gates.mjs](../scripts/review-corpus/gates.mjs) is
**backlog-card-only** — its first statement is
`if (!/^backlog\//.test(path || '') || typeof read !== 'function') return [];`, and its registry entry reads
`{ name: 'vacuous-executable-criterion', fn: vacuousExecutableCriterion, targets: 'backlog card' }`. So
direction is not the problem: cards are the only thing it is ever handed.

Run directly against #3319's pre-fix text — the card as it stood at commit `d2f8b77a`, with `path` set to that
card — it returns `[]`. It bails at

```js
const demandsAbsence = /returns? \*{0,2}zero\*{0,2} hits|\bis gone\b|\bno longer (?:appears|occurs)\b|returns? nothing/i.test(crit.text);
if (!demandsAbsence) continue;
```

before reading any file. #3319's criterion ran `npx vitest run` over
`we:scripts/operations/__tests__/review-pr.test.mjs` under `-t "#3319"` — no absence demanded anywhere in it,
so `demandsAbsence` is `false`. That command exits **0** on `origin/main`: a `-t` filter matching nothing is a
selection of zero, and vitest scores an empty selection as success. Green before the work, which is precisely
what the gate exists to catch.

## The shape to add

A criterion whose command is a **test-runner invocation under a name/path filter** is vacuous unless it also
asserts that tests *ran*. Detect the filter form (`vitest … -t`, `--testNamePattern`, a `run <path>` that
resolves to no file) with no downstream assertion of a non-zero pass count — `| grep -qE "Tests +[0-9]+ passed"`
being the shape #3319 landed as its fix. Keep the existing absence detector; this is a second predicate beside
it, not a replacement.

The general principle is worth stating in the gate's own doc comment, because more shapes will follow:
**a criterion is vacuous when its success is independent of the work**, and "the literal is already missing"
and "the selection is already empty" are two instances of that, not the whole set.

## Done when

1. **Executable** — a case in `we:scripts/review-corpus/__tests__/gates.test.mjs` feeding
   `vacuousExecutableCriterion` the #3319 pre-fix criterion text and asserting **one** finding of gate
   `vacuous-executable-criterion`. It fails today (the gate returns `[]`) and passes after.
2. `npm run check:standards` — 0 errors.
