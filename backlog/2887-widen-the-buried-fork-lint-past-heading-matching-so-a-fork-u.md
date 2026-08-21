---
bornAs: xf61jll
kind: story
size: 3
status: open
dateOpened: "2026-08-02"
relatedTo: ["2884", "2883"]
tags: [gate, backlog, fork, check-standards, hookable]
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
---

# Widen the buried-fork lint past heading matching so a fork under a narrative heading is caught

`findBuriedForkSections` keys on a fixed nine-phrase heading list, so a fork written under a narrative heading passes the gate invisibly — which is how #2884 shipped `batchable` with three options and no default.

## The blind spot

[we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs#L472-L493) matches a section
against `FORK_HEADING_TERMS`
([we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs#L452-L455)) — nine fixed phrases:
`open design`, `open decision`, `open question`, `open fork`, `open sub-decision`, `design tension`,
`forks to settle`, `decisions to settle`, `tensions to settle`. The predicate is HEADING-keyed only; the
body is never examined.

So the lint catches a fork only when the author already labelled it as one. An author who writes the fork up
honestly under an analytic heading trips nothing.

## The instance that proves it

[we:backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md](backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md)
carries a live three-option fork with no default, under the headings "This is a ratified tradeoff, not an
oversight" / "The evidence — PR #983" / "The obvious fix is not free". None matches `FORK_HEADING_TERMS`.
`findNonBatchableMarkers` ([we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs#L592-L611))
does not fire either. `npm run check:standards` exits 0 with zero lines mentioning #2884, and the item
computes `tier: A, batchable: true`.

The failure mode is perverse: the *better* the fork is written up — sober, analytic, no "open question"
banner — the less likely the gate is to see it. #2883 has the same shape in milder form ("it should be a
deliberate call, not a side effect").

[we:src/_data/backlog.js](src/_data/backlog.js#L475-L476) already states the gap plainly: "The one
non-structural guard the batch skill adds — no buried design fork in the body — can't be decided from
fields … selection still skims the body for a fork." This item is about moving that skim from model recall
into a deterministic gate (#51: script-decidable becomes a hook).

## Shape of the widening

Two tells worth detecting, both mechanical and both present in #2884:

- **Option enumeration** — a section carrying two or more bullets that open with a bolded or lettered option
  label (`- **X** — …`, `(a)`/`(b)`) on a non-`decision`, non-`resolved` item. That is the shape a carved fork
  has and a build story does not. *(This first sketch also said "with no `blockedBy` edge to a `kind: decision`";
  that is a cross-item check and `findBuriedForkSections` is pure over the body string, so it is not buildable
  there. The **Design** section below supersedes it with the suppression that already exists in the function —
  follow the Design section, not this line.)*
- **Deferred-choice phrasing** — the wordings that appear in a body when the author knows the call is open:
  "a deliberate call, not a side effect", "options worth weighing", "whichever option is taken", "the
  tension to resolve", "cross-check with the sibling". Fits `NON_BATCHABLE_MARKERS` rather than the fork
  detector.

Both self-clear the moment the fork is carved, so neither becomes a nag. The false-positive risk is real —
a story legitimately listing implementation notes as bullets — so the rule should warn before it errors, and
the first pass over the existing 2858 items should be inspected before the severity is set.

## Design

Both tells go in `we:scripts/check-standards-rules.mjs`, beside the predicates they widen, and both stay
**pure over the body string** — the caller already strips frontmatter and already restricts the fork scan to
non-`decision`, non-`resolved` items (`we:scripts/check-standards-rules.mjs:799-808`).

**Tell A — option enumeration, in `findBuriedForkSections`.** Today the function short-circuits on
`FORK_HEADING_TERMS` before ever looking at the section body
(`we:scripts/check-standards-rules.mjs:485`). Widen it to a two-branch match: a section qualifies **either**
by heading phrase (today's path, unchanged) **or** by carrying ≥2 bullets whose text opens with an option
label — `- **X** — …` or a `(a)`/`(b)` lettering. The existing suppression is reused untouched: a section is
still dropped when `ITEM_REF_RX` and `FORK_SETTLED_RX` both hit (`:489`), which is what makes the rule
self-clearing the moment the fork is carved.

**Tell B — deferred-choice phrasing, in `NON_BATCHABLE_MARKERS`.** That table
(`we:scripts/check-standards-rules.mjs:575-584`) is already `[label, regex]` pairs scanned line-by-line with
fenced code skipped and inline code deliberately NOT skipped (`:603-605`). The phrasings belong here rather than
in the fork detector: they are sentence-level tells with no section structure, and this scanner is already
the sentence-level one. Its caller gates on `item.batchable === true` (`:812`), which is exactly the
population the widening is for.

**Severity is measured, not chosen.** `findBuriedForkSections` returns `{line, heading}` and
`findNonBatchableMarkers` returns `{line, marker}`, both pure — so the corpus sweep is a short script over
`backlog/*.md` that calls them directly, with no need to run the whole gate. Run it, read the hits, then
set severity. The existing fork finding is a **warning** (`:803`); a new tell that fires more widely must
not be stricter than the one it extends without the count to justify it.

## Done when

1. **tier 1 — tell A.** `we:scripts/__tests__/check-standards-rules.test.mjs` pins `findBuriedForkSections`
   on the option-enumeration tell: a section under a narrative heading with three `- **X** — …` bullets is
   returned; the same section with an `#NNN` + carve/resolve pointer is suppressed; a section with one such
   bullet is not returned. Fails before — the body is never examined.
2. **tier 1 — tell B.** The same file pins the deferred-choice phrasings through
   `findNonBatchableMarkers`: each new phrasing produces a hit with its label, and a body containing none
   produces `[]`. Fails before — the phrasings are not in `NON_BATCHABLE_MARKERS`.
3. **tier 1 — the two regression fixtures, and the false-positive guard.** The same file asserts the
   widened rule fires on the real bodies of `we:backlog/2884-…` and `we:backlog/2883-…` (checked in as
   fixtures, not read from disk, so the test does not decay when those items resolve), and does **not**
   fire on a story whose bullets are ordinary implementation notes.
4. **tier 2 — the corpus count is recorded, and severity follows it.** The item's close-out states the
   full-corpus hit count from a sweep over every `backlog/*.md`, and the severity chosen for each tell,
   with the count as the stated reason. An unmeasured severity fails this criterion.
5. **tier 2 — no new gate errors.** `npm run check:standards` against the current `backlog/` produces no
   new **errors** attributable to this item (new **warnings** are the expected and intended output).

The commands that decide 1-3 and 5:

```
npx vitest run scripts/__tests__/check-standards-rules.test.mjs
npm run check:standards
```

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: confirm by mutation or reversion BEFORE building) — Independently re-ran findBuriedForkSections/findNonBatchableMarkers against we:backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md and we:backlog/2883-a-stale-acceptance-must-stay-non-waivable-after-the-accepted.md — both return [] today, confirming the card's central claim before any code is written.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — DoD item 4 explicitly requires a full-corpus sweep over backlog/*.md and states severity must follow the measured count, with an unmeasured severity called out as a failing criterion — the false-positive risk (ordinary implementation-note bullets) is named directly in the card's own 'Shape of the widening' section.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The only importers of findBuriedForkSections/NON_BATCHABLE_MARKERS in the repo are we:scripts/check-standards-rules.mjs itself and we:scripts/__tests__/check-standards-rules.test.mjs; the subprocess caller is `npm run check:standards`, wired into we:.github/workflows/ci.yml, we:.github/workflows/publish-contracts.yml and we:.github/workflows/release-please.yml, and `process.exitCode = errors.length ? 1 : 0` in we:scripts/check-standards.mjs means the new warn-only tells cannot fail CI — consistent with the card's DoD item 5.
- **population** (addressed; strategy: name the population each threshold guards) — Both tells reuse existing, already-scoped populations rather than inventing new ones: Tell A rides the caller's existing non-decision/non-resolved restriction at we:scripts/check-standards-rules.mjs:799, Tell B rides the existing item.batchable === true restriction at we:scripts/check-standards-rules.mjs:811-812.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — DoD items 1-3 are explicitly test-first ('Fails before — the body is never examined' / 'the phrasings are not in NON_BATCHABLE_MARKERS'), and pin against checked-in fixtures from the two real regression bodies plus a false-positive fixture, which is the named-test-reddens discipline this risk asks for.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — DoD item 4 makes the corpus hit count a hard prerequisite to setting severity ('An unmeasured severity fails this criterion'), and ties the new tells' severity ceiling to the existing fork finding's warning severity absent a count that justifies going stricter.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Both tells flow through the existing warnings.push() call sites already wired to we:scripts/check-standards.mjs's console/JSON output (we:scripts/check-standards-rules.mjs:800-807, 811-822) — no new surfacing path is introduced, so nothing about the widening changes whether a hit reaches a human.

**Corrections applied by this review:**

- The card cites `:592` in we:scripts/check-standards-rules.mjs for the claim that fenced code is skipped and inline code is deliberately not skipped — that behavior is actually documented at lines 603-605 (`:592` is just the findNonBatchableMarkers function signature line).
- The 'Shape of the widening' section describes Tell A's suppression as keying on 'no blockedBy edge to a kind: decision' (a cross-item check), but the 'Design' section correctly supersedes this with the existing single-string suppression at we:scripts/check-standards-rules.mjs:489 (ITEM_REF_RX + FORK_SETTLED_RX) — only the latter is buildable given findBuriedForkSections's pure body-string signature, so a builder should follow the Design section, not the earlier prose.

The card's blind-spot claim and its two regression instances are independently verified against the live repo (findBuriedForkSections/findNonBatchableMarkers both return [] on we:backlog/2884-... and we:backlog/2883-... today), its line citations are almost all exact, and its design is scoped, test-first, warning-severity-first, and reuses existing populations/suppression/output plumbing — no blocking defects found.

_Recorded through the declared `review-prep` operation._
