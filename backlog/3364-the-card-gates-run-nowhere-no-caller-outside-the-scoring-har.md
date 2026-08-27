---
bornAs: xjzkvg4
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-27"
scope:
  - we:scripts/check-standards.mjs
tags: []
---

# The card gates run nowhere — no caller outside the scoring harness

Every gate in the review-corpus gate library is imported only by the replay harness, which scores candidates against recorded reviews. Nothing invokes them at write time, at prepare time, or in the standards check, so a defect a gate detects still ships.

## Verified, not assumed

```
grep -rln "review-corpus/gates.mjs" scripts/
  → scripts/review-corpus/gates.mjs
  → scripts/review-corpus/replay-gates.mjs
```

Two hits: the file itself, and the **scoring harness**. `we:scripts/check-standards.mjs` and
`we:scripts/check-standards-rules.mjs` contain no reference. So the entire library is **candidates**, measured
against history and invoked by nothing that guards a write, a card, or a land.

## Why this matters more now than it did yesterday

Five items target that library, and **all five build detectors into a file nothing calls**:

| item | gate |
| --- | --- |
| [#3340](/backlog/3340/) | vacuous criterion — the empty test selection shape |
| [#3341](/backlog/3341/) | an uncited mechanism claim, 17 findings across 3336 cards |
| [#3346](/backlog/3346/) | `vacuous-executable-criterion` models absence only |
| [#3362](/backlog/3362/) | a check must state its predicate and candidate set |
| [#3319](/backlog/3319/) | (touches the same library) |

Each is individually good work with a measured false-positive rate. Together they are a library whose net
effect on anything shipping today is **zero**.

## A precise note on an earlier retraction, because this is adjacent and must not be confused with it

An earlier card claimed *"the gate scores a corpus of past reviews and never runs against a backlog card"* and
concluded *"a detector pointed only backwards catches nobody."* **That was retracted, and the retraction was
correct**: `vacuousExecutableCriterion` opens with `if (!/^backlog\//.test(path || ''))` and is registered
`targets: 'backlog card'`, so backlog cards are exactly and only what it scans. The stated mechanism was wrong.

**This item is a different fact and does not revive that claim.** What a gate *scans* and whether anything
*calls* it are independent. The gate targets cards correctly; no caller passes it a card outside the harness.
Recorded explicitly so a future reader does not read this as the retracted claim returning by the back door —
and because getting that distinction wrong is precisely the error the retraction punished.

## What to decide, and it is a real decision

**Which gates deploy, where, and at what severity.** Not "wire them all in" — the library holds heuristics with
known false-positive rates, and the ones measured so far differ by an order of magnitude:

- #3341: **17 / 3336 cards (0.5%)**, adjudicated 13 true · 1 arguable · 3 false.
- #3340: **0 findings** across the tree — a pure regression guard.

Candidate call sites, each with a different cost and blast radius:

- **Write-time** (`PreToolUse` hook, the precedent `we:scripts/lint-locus-prefix.mjs` sets) — tightest loop,
  but several gates need repo context and a hook that shells out to git on every write is a real cost.
- **`check:standards`** — the natural home for card-shaped rules, and the place a false positive is loudest.
- **Prepare close-out** — where a card is finished, which suits gates that need the card complete.

**Severity is the other half.** A hard failure on a heuristic gets routed around within a day, after which it
protects nothing — the pattern named on #3340 and measured on [#3308](/backlog/3308/), where a first draft
fired on 59 of 60 merged PRs before being cut to 8. Warn-first is likely right for the fuzzy gates and wrong
for the crisp ones.

## Do not deploy on a score alone

The replay harness measures a gate's **precision against labels that exist**. #3341's replay returned
*0 labels caught, 6 extras* — and the 0 is **not** a miss rate: none of the 39 confirmed labels is an instance
of that class, because the class was named later than every mined case. A score of 0/0 is undefined, not
failed. Any deployment rule keyed on replay score has to handle that case or it will reject exactly the gates
written for defects the corpus predates.

## Done when

1. **Executable** — at least one gate runs from a real call site, and a card carrying the defect it detects is
   flagged where an author will see it, while a clean card passes. Both directions.
2. Each gate in the library is classified — deployed (and where, at what severity), warn-only, or not-yet — with
   the measured finding count that justifies the classification recorded beside it.
3. `npm run check:standards` — 0 errors.
