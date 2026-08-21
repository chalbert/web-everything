---
bornAs: xy8e7h0
kind: story
size: 3
relatedTo: ["2285", "2287", "2263"]
status: open
dateOpened: "2026-07-12"
tags: [review, drain, cross-repo, mechanical-gate]
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
  - we:scripts/operations/review-pr.mjs
  - we:scripts/review-core-cli.mjs
  - we:scripts/__tests__/review-core-cli.test.mjs
  - we:scripts/lib/__tests__/review-runner-core.test.mjs
---

# Resolve a couple's cross-repo symbol MECHANICALLY, before the reviewer ever sees it

A fresh-context diff-only reviewer judging ONE half of a cross-repo couple false-positives on symbols
the sibling PR adds: re-reviewing plateau#19, the round-2 reviewer's only finding was that
`--under-lease` does not exist in `we:scripts/merge-ai-prs.mjs` — it verified against WE main, where the
couple's WE half had not landed. The fix is **not** to tell the reviewer anything: the drain already has
sibling clones and the manifest already names their refs, so "does this symbol exist in the couple" is
script-decidable — fetch each `repos[].ref`, grep, drop the finding before it reaches a mandate.

## Re-scoped 2026-08-03 — the prompt approach was tried twice and rejected

The original fix line (thread the manifest's repo/ref list into the mandate text) was built as PR
#1011 and bounced twice by `/review`, then the boolean-flag retreat was bounced again. That PR is
**closed**; this item is re-scoped to the mechanical check. Recorded because the failures generalise:

1. **It cannot fire where the bug lives.** Only a WE PR carries a lane manifest —
   `we:scripts/merge-ai-prs.mjs` states it outright: *"an orphan/impl PR has none → null"*. The
   motivating incident was plateau#19, an **impl** half. Any manifest-derived signal is null there.
2. **The amnesty excuses same-repo bugs.** A couple is one PR per repo, so the sibling half can never
   define a symbol in *this* repo — yet the instruction's operative test is "absent from this repo",
   which is the **only** basis a diff-only reviewer has for an undefined-symbol finding. A genuinely
   missing local helper then reads as expected-mid-couple: a false negative on the mandatory
   correctness lens, on every couple.
3. **The trigger stays author-controlled even as one bit.** `crossRepo = m.repos.length > 1`, read
   PR-body-first, and the body is author-editable. One extra `repos` entry buys amnesty across every
   lens **and** the #2439 independent validator. Closing the *data* channel (the first retreat) does
   not close the *control* channel.

Root pattern: a review-**relaxing** signal satisfiable by author assertion is a control channel, and
no amount of sanitising or corroboration fixes that — corroboration proves existence, not identity.

## Why mechanical is strictly better

- **It fires on both halves.** The check keys on the couple's refs, not on which repo holds the
  manifest.
- **It is exact, so there is no amnesty.** It answers "this symbol exists at X" or "it exists
  nowhere". A same-repo missing helper still reports normally — the failure mode inverted in (2)
  cannot occur.
- **Forgery collapses into compliance.** To make the check pass you must actually add the symbol.
  There is no bit to flip.
- **It never touches a prompt**, so no author-controlled bytes reach the gate that judges that author.
- Memory rule #51: script-decidable → hook, judgment stays in context. Symbol existence is
  script-decidable.

## The machinery already exists

- `siblingCloneName` / `CONSTELLATION_REPO_NAMES` (`we:scripts/merge-ai-prs.mjs`, #2287/#2263) already
  give the drain local clones of `web-everything`, `frontierui` and `plateau-app`.
- The lane manifest already carries `repos[].ref` — the same field `crossRepo` reads today.
- `resolveNetDiffBasis` already fetches arbitrary refs **without checkout** (#2336-safe), so the
  fetch primitive is in hand.

Nothing new needs building at the transport layer; this is a filter step plus its oracles.

## Design

> **Corrected 2026-08-21 after the independent prep review.** An earlier draft of this section put the
> filter inside `we:scripts/merge-ai-prs.mjs`'s escalation arc. That is wrong and the juror was right:
> a `grep -c` for `buildMandate`/`buildPanelMandate` in `we:scripts/merge-ai-prs.mjs` returns **0**. The escalation pass
> (`scoreEscalation`, ~`we:scripts/merge-ai-prs.mjs:3210-3320`) runs *before* any reviewer is invoked — it
> decides whether to PARK a PR for review from manifest-derived signals, and never sees a reviewer finding.
> The corrected placement is below.

**Where the primitives are, and where the seam is — two different files.**

*The primitives* live in `we:scripts/merge-ai-prs.mjs` and are exactly what the couple check needs:

- `siblingCloneName(repo)` (`we:scripts/merge-ai-prs.mjs:1874`) maps a repo slug to the local sibling clone
  name, keyed off `CONSTELLATION_REPO_NAMES` (`:1806`) — `web-everything`, `frontierui`, `plateau-app`.
- The couple manifest is read by `extractManifestFromBody` (from `we:scripts/readiness/lane-manifest.mjs`),
  and `v.crossRepo` is derived from `m.repos.length > 1` at `we:scripts/merge-ai-prs.mjs:1267` — the same
  `repos[]` array carries each half's `ref`.
- `resolveNetDiffBasis({ exec, remote, base, rev, fetchExtraRefs })`
  (`we:scripts/merge-ai-prs.mjs:2060`) already fetches arbitrary refs **without checkout** (#2336-safe).

*The seam* — the point where a reviewer's findings become a verdict/mandate — is in two other places, and
**both must be wired or the filter never fires**:

1. `we:scripts/operations/review-pr.mjs`: the `judge` step spawns the juror via `buildPanelMandate`, and the
   `reduce` step immediately does `normalizeFindings(answer.findings)` (`:461`) → `deriveVerdict`. The filter
   belongs between those two — after normalization, before reduction.
2. `we:scripts/review-core-cli.mjs`: `buildMandateText({ kind, lens, findings, round, roundCap, diffBasis })`
   (`:225`), whose `editor` kind reads the reviewer's findings out of stdin (`runMandate`, `:495-505`). This
   is the CLI seam the **mechanized** panel (`we:scripts/workflows/review-parked-prs.mjs`) seeds every lens
   through — the same seam this card's *Residue from the closed PR* section already names.

Because the oracle is needed in a file that should not import the whole drain CLI, **extract the pure half
into `we:scripts/lib/`** and have `we:scripts/merge-ai-prs.mjs` keep only the couple-context lookup it
already owns. That keeps the primitives where they are and puts the decision where the findings are.

**Shape.** A pure oracle plus a thin I/O wrapper, so the decision is unit-testable with no network:

```js
// pure — decides, given what the greps found
export function filterCoupleResolvedFindings(findings, { resolvedSymbols, checkRan }) { /* … */ }
// I/O — fetch each sibling ref, grep the symbol, report {resolved, whereRef} | {checkRan:false}
export function resolveSymbolInCoupleRefs({ symbol, repos, exec, cloneOf = siblingCloneName }) { /* … */ }
```

`checkRan: false` is the honest-degradation channel: an absent sibling clone or a failed fetch produces it,
and the pure filter then drops nothing. That flag must be a distinct value, not a falsy `resolved` —
conflating "did not resolve" with "could not check" is the failure mode A4 forbids.

**Symbol extraction.** The reviewer's finding already names the symbol in its text (the motivating case:
`--under-lease`). Extract candidate identifiers from the finding's own summary rather than re-parsing the
diff — the diff is what the reviewer already read, and re-deriving it here would fork the parse. Where no
identifier can be extracted, the finding passes through unfiltered (same fail-open-to-reporting direction as
A4).

## Done when

1. **tier 1 — the oracle.** `we:scripts/__tests__/merge-ai-prs.test.mjs` pins the pure filter: a finding
   whose symbol is reported resolved in a sibling `repos[].ref` is dropped; one resolved nowhere is kept;
   one carried with `checkRan: false` is kept. Fails before — the function does not exist.
2. **tier 1 — the motivating case (A5).** The same file reproduces plateau#19's shape end to end with an
   injected `exec`: an impl-half diff referencing a flag defined only in the couple's unlanded WE half is
   NOT reported. Fails before — today it is.
3. **tier 1 — no blanket behaviour (A3).** A negative oracle in the same file: a genuinely missing
   *local* helper on a couple half still surfaces as a finding. This is the assertion that proves the
   check did not become the amnesty the re-scope was fleeing.
4. **tier 1 — the filter is WIRED, not merely written.** A test that reddens when the integration is
   removed, at **both** seams: `we:scripts/lib/__tests__/review-runner-core.test.mjs` (or the test file
   covering `we:scripts/operations/review-pr.mjs`'s `reduce` step) asserts a couple-resolved finding is
   absent from the reduced verdict, and `we:scripts/__tests__/review-core-cli.test.mjs` asserts the same
   for an `editor` mandate built from stdin findings. Deleting the call at either seam must fail a **named**
   test — a pure oracle nothing calls is the defect this criterion exists to prevent.
5. **tier 2 — filter, do not instruct (A2), and it fires on both halves (A1).** `buildMandate` and
   `buildPanelMandate` in `we:scripts/lib/review-core.mjs` keep their current signatures and their rendered
   text is byte-identical for a fixed input (`we:scripts/lib/__tests__/review-core.test.mjs`); no
   couple-context parameter appears in either. And the resolver keys on `repos[].ref`, never on which repo
   holds the manifest — a unit case runs it from an **impl** half whose own PR carries no manifest and it
   still resolves against the WE ref.

The commands that decide 1-5:

```
npx vitest run scripts/__tests__/merge-ai-prs.test.mjs
npx vitest run scripts/lib/__tests__/review-core.test.mjs
npx vitest run scripts/lib/__tests__/review-runner-core.test.mjs scripts/__tests__/review-core-cli.test.mjs
```

## Boundary

Not a mandate-text change, and explicitly **not** a couple-context parameter — that is the approach
this item was re-scoped away from. Not a numbering or link-syntax change either: the check searches
the couple's known refs, so it never needs a reference to name which ref defines the symbol.

## Residue from the closed PR

`we:scripts/review-core-cli.mjs`'s `buildMandateText()` passes no `netChangedFiles`, so #2450's
ground-truth block never reaches a reviewer seeded through the CLI seam — and
`we:scripts/workflows/review-parked-prs.mjs`, the **mechanized** panel, seeds every lens through
exactly that CLI. That gap is real, independent of this item, and is filed separately.

## Independent review — 2026-08-21

Confidence: **Low**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: confirm by mutation or reversion BEFORE building) — FALSE PREMISE, verified against the live repo: we:scripts/merge-ai-prs.mjs's REVIEW-ESCALATION pass (~we:scripts/merge-ai-prs.mjs:3210-3320) never receives reviewer findings and never calls buildMandate/buildPanelMandate — grep for both across we:scripts/merge-ai-prs.mjs returns zero hits. That pass runs BEFORE any reviewer is invoked: it feeds scoreEscalation() with manifest-derived signals (diff size, dismissedFindings, crossRepo) to decide whether to PARK a PR for review at all (apply review:pending). The actual 'reviewer returned findings' -> 'mandate/verdict is built' boundary the card wants to filter lives in we:scripts/operations/review-pr.mjs's judge step (spawns the juror with buildPanelMandate, producing findings.judge) followed immediately by its reduce step (normalizeFindings(answer.findings) -> deriveVerdict), and a second such boundary exists in we:scripts/review-core-cli.mjs's buildMandateText({kind, lens, findings, round, roundCap, diffBasis}) used by the mechanized panel (we:scripts/workflows/review-parked-prs.mjs). Neither file is in the card's declared scope.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The real consumers of 'a reviewer's findings, about to become a mandate/verdict' are we:scripts/operations/review-pr.mjs (judge->reduce) and we:scripts/review-core-cli.mjs (buildMandateText), not we:scripts/merge-ai-prs.mjs or we:scripts/lib/review-core.mjs. The card's declared scope names only the latter two plus their tests, so the filter's actual insertion point is unnamed and untouched.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — If built exactly to the card's Done-when criteria, filterCoupleResolvedFindings/resolveSymbolInCoupleRefs would be pure, unit-tested functions living in we:scripts/merge-ai-prs.mjs with no caller anywhere in the finding-processing path. All 5 Done-when tests (we:scripts/__tests__/merge-ai-prs.test.mjs, we:scripts/lib/__tests__/review-core.test.mjs) exercise the oracle directly or assert we:scripts/lib/review-core.mjs's mandate text is unchanged — none call through we:scripts/operations/review-pr.mjs's reduce step or we:scripts/review-core-cli.mjs's buildMandateText, so none would redden if the new functions were simply never wired into either. This is the taxonomy's textbook case: the guard exists and, on the real production path, enforces nothing. Disposition: introduced by this card's own design (not a pre-existing repo defect) = true; net worse than the base (which at least honestly has no mechanism, vs. this shipping a closed, tested-green backlog item that gives false confidence the plateau#19 class of false positive is now prevented) = true; parallelizable away from this change = false, because correctly locating the filter IS this card's stated goal, not an ancillary concern. That combination (introduced AND worse-than-base AND not parallelizable) is the routing that earns a blocking round rather than a carve-out. Impact if unfixed: broken (the protection silently doesn't fire; recoverable only once someone notices a plateau#19-shaped false positive recur and traces why the 'fix' didn't catch it). No mutation probe applies in the literal sense (no code exists yet to break), but the equivalent holds: none of the five Done-when tests would redden if the entire integration into we:scripts/operations/review-pr.mjs / we:scripts/review-core-cli.mjs were omitted, because none of them touch those files. Root cause: the author found real, reusable machinery (siblingCloneName, crossRepo, resolveNetDiffBasis) all colocated in we:scripts/merge-ai-prs.mjs and inferred the consuming logic (mandate built from reviewer findings) lived in the same file, without independently grepping for the actual callers of buildMandate/buildPanelMandate/buildMandateText to confirm the claimed boundary exists there. Prevention: the cheapest durable guard is a preparation-checklist rule that any card claiming to filter/intercept between two named pipeline stages (e.g. 'reviewer returns findings' and 'mandate is built') must cite the actual function call that performs the second stage and confirm (by grep) that it is reachable from the file(s) in scope — a review lens or checklist item, not a deterministic gate, since 'is this the real integration point' isn't cheaply script-decidable in general. Not currently captured anywhere in this repo's checklist (preventionCaptured = false) — should be filed.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card explicitly designs checkRan:false as a distinct, non-falsy value from resolved:false specifically so 'could not check' never silently collapses into 'did not resolve, drop nothing' — an honest-degradation channel, correctly reasoned regardless of the wiring-location defect above.

**Corrections applied by this review:**

- "Where it lands" claims the filter sits inside we:scripts/merge-ai-prs.mjs's escalation arc, between the reviewer returning findings and the mandate/verdict being built — but that arc (scoreEscalation, ~we:scripts/merge-ai-prs.mjs:3210-3320) runs before any reviewer is invoked and never touches reviewer findings or buildMandate/buildPanelMandate; the real findings-to-verdict boundary is we:scripts/operations/review-pr.mjs's judge->reduce steps (and, for the mechanized panel, we:scripts/review-core-cli.mjs's buildMandateText), neither of which is in the card's declared scope.

The primitives cited (siblingCloneName, crossRepo, resolveNetDiffBasis) check out and the pure/IO split is sound, but the card's central design claim — that we:scripts/merge-ai-prs.mjs's escalation arc sits "between 'the reviewer returned findings' and 'the mandate/verdict is built'" — is false against the live repo, so the mechanism as scoped would never see a real reviewer finding to filter.

_Recorded through the declared `review-prep` operation._

### Response to that review (2026-08-21)

All three "NOT addressed" risks are accepted and fixed **in the card**, so a builder no longer inherits them:

- **premise / consumer** — the *Design* section is rewritten. The filter's home is now stated as the
  findings→verdict seam in `we:scripts/operations/review-pr.mjs` (between `normalizeFindings` and
  `deriveVerdict`) and `we:scripts/review-core-cli.mjs`'s `buildMandateText`, with
  `we:scripts/merge-ai-prs.mjs` keeping only the couple-context primitives it already owns. `scope:` now
  names those files.
- **decorative-guard** — Done-when criterion 4 is now a **tier-1 wiring** criterion: a named test at each
  seam must redden when the integration call is deleted. A pure oracle nothing calls no longer satisfies
  this card.

The juror's prevention suggestion (a prep-checklist rule: a card claiming to intercept between two pipeline
stages must cite the function performing the second stage and confirm by grep that it is reachable from the
files in scope) is **not** captured anywhere today and is worth filing on its own — it is not folded in here.
