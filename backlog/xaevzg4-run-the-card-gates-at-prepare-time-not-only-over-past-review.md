---
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/review-corpus/gates.mjs
tags: []
---

# Run the card gates at prepare time, not only over past reviews

The eight candidate gates score a corpus of recorded reviews and never run against a backlog card, so a defect they detect can still ship. A detector pointed only backwards catches nobody.

## The gap

`we:scripts/review-corpus/gates.mjs` holds eight pure `(text, ctx) => Finding[]` gates —
`resolved-with-todo`, `stale-gate-count`, `dangling-wikilink`, `dangling-hash-id`, `grep-literal-mismatch`,
`vacuous-executable-criterion`, `scope-omits-donewhen-file`, `citation-line-content`.

They have exactly one caller: `we:scripts/review-corpus/replay-gates.mjs`, which scores them against a corpus
of **already-recorded** reviews to measure how many past findings a gate would have caught. That is the right
harness for *evaluating* a gate. It is not a place where a gate can *prevent* anything — the material it reads
is, by construction, historical.

So a card can be written today containing exactly the defect a gate detects, and nothing fires.

## This already happened, twice, in one day

**`vacuous-executable-criterion`.** The card for [#3319](/backlog/3319/) shipped with
`npx vitest run … -t "#3319"` as its executable criterion. On `origin/main` that exits **0** — 368 files and
9221 tests *skipped*, because a `-t` filter matching nothing is a selection of zero and vitest treats an empty
selection as success. The card asserted "Fails before this item lands." It passed vacuously, and a reviewer
caught it rather than a gate. **The same session had written the detector.**

**`dangling-hash-id`.** A commit message, a PR title and a PR body all cited `#x7kopnm`, which the authoring
session then decided was a phantom because `grep` found nothing — it had been filed but not yet landed. See
[#3327](/backlog/3327/); it produced a duplicate card and two lands to unwind. A prose-citation check is a
near-sibling of this gate and is noted there.

Two gates, two same-day misses, both by the session that built them. The gates were not wrong — they were
pointed at the past.

## What to build

Run the gate registry over the **card being written**, at the point of writing, and fail the write or the
gate run.

Design questions worth settling rather than assuming:

- **Where does it hook?** The `PreToolUse(Edit|Write)` hook is the existing precedent for write-time content
  scanning (#883, `we:scripts/lint-locus-prefix.mjs`). That gives the tightest loop, but several gates need
  repo context (`dangling-hash-id` must consult `origin/main`, not just the tree — that is the #3327 lesson)
  and a hook that shells out to git on every write is a cost.
- **Which gates are write-time and which are gate-run-time?** `vacuous-executable-criterion` must actually
  *run the command* to know it is vacuous, which is not a write-time operation. It likely belongs in
  `check:standards` or in the prepare close-out, not in a hook.
- **What is the failure mode when a gate cannot decide?** These are heuristics scored against a corpus, not
  proofs. A gate that hard-fails a write on a false positive will be routed around within a day, and then it
  protects nothing. Prefer warn-at-write / fail-at-gate for the fuzzier gates, and reserve hard refusal for the
  ones with a crisp decision procedure.

**Do not simply wire all eight.** The replay harness exists precisely to say which gates earn their false
positives; use its scores to decide which are hard failures, which are warnings, and which are not yet ready.

## The generalizable claim

**A detector that only looks backwards catches nobody.** Any gate built by scoring historical data is
measuring its own precision, not preventing anything, until it runs at the moment the defect is authored. Worth
stating as a rule about how this repo builds gates, not just as a fix for these eight.

## Done when

1. **Executable** — a card containing a known-vacuous executable criterion is refused or flagged by a command
   that passes on a card without one. Both directions asserted; a check that fires on everything is not a check.
2. Each of the eight gates is explicitly classified as write-time refusal, gate-run failure, warning, or
   not-yet-wired — with the replay score that justifies the classification recorded.
3. `npm run check:standards` — 0 errors.
