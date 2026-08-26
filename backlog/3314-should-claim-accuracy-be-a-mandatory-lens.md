---
bornAs: xe9hwyi
kind: decision
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateStarted: "2026-08-26"
dateResolved: "2026-08-26"
codifiedIn: "docs/agent/platform-decisions.md#claim-accuracy-advisory-blocks-on-impact"
preparedDate: "2026-08-26"
tags: []
---

# Should claim-accuracy be a mandatory lens

**Ruled 2026-08-26: no — it stays advisory, and what blocks is impact, not the lens.** A
claim-accuracy finding declared `broken` or above blocks acceptance; everything below the bar advises and
never blocks. The sub-class is the **existing** typed `impactIfUnfixed` field (`IMPACT_LEVELS` in
`we:scripts/lib/jury-core.mjs`), not a new field and not reviewer discretion. **Nothing blocks yet** — the
scan that makes an *outstanding* above-bar advisory finding block is `#x38ergj`; until it lands the lens is
plain advisory. Codified as `#claim-accuracy-advisory-blocks-on-impact` in
`we:docs/agent/platform-decisions.md`.

## The options

Prepared as **Fork 1** (#1582) and a real fork on the fork-existence test: `MANDATORY_LENSES` and
`ADVISORY_LENSES` (`we:scripts/lib/jury-core.mjs`) are **disjoint sets**, and membership decides whether the
lens can block a land — so the branches cannot coexist and exactly one is correct. Screened clear: not an
implementation detail (lens weighting is observable at the WE↔FUI boundary, in whether a PR can land) and not
prioritisation (with both branches free to build, a merit difference remains).

- **(a) mandatory** — add `claim-accuracy` to `MANDATORY_LENSES`. Meets [#2310](/backlog/2310/)'s criterion
  on its face: mandatory means *a genuine invariant with no other backstop*, and the deterministic backstop
  for this class was built and measured at **5 of 39** confirmed labels (12.8%, of which only 3 survived
  hand-inspection) — so there effectively is none.
- **(b) advisory** — leave it where #3035 landed it, permanently.
- **(c) advisory, with a scoped blocking sub-class** — *ruled*. Out of the mandatory set, **and** a narrow
  typed category blocks.

## Why not mandatory

**Mandatory means unanimity, and this lens's finding population is by construction dominated by low-impact
prose.** That is not a claim about how the lens happened to behave on some sample — it follows from what the
lens *is*. Its subject is the writing about the repo: card bodies, Done-when criteria, docs, agent-memory
notes, code comments, PR descriptions. A lens pointed at prose will return mostly prose findings, and
promoting it wholesale makes a wrong figure in a paragraph nobody depends on sufficient to stop a land.
That runs against the reviewer bar this constellation is converging on
([#blast-radius-advisory-care-not-a-gate](/backlog/2563/)): review capacity scales, review *permission*
does not. **This is an extension of that principle, not a derivation from it** — #2563 clause 1 governs
*scored signals* (blast-radius, size, dismissed-findings, cross-repo, sampling) and a lens's mandate is not
one, so the anchor does not already forbid the promotion. It supplies the direction; the argument above
carries the weight.

The distinction that matters is therefore **not** which lens found it but **what shipping it costs** — which
is already a first-class typed field, and already the thing every other blocking decision in the panel reads.

## Why the sub-class is `impactIfUnfixed`, not a new field

The skeptic's attack on (c) was *"an advisory lens whose findings sometimes block is a mandatory lens with
extra steps"* — which holds unless the sub-class is definable without judgement. It is, and the definition
already exists. `IMPACT_GLOSS` maps the intended sub-class almost exactly:

| the sub-class, in prose | the existing typed level |
| --- | --- |
| a wrong acceptance criterion, a wrong `file:line` a card directs work to, a "this already handles X" that stops someone building X | `broken` — *"real work is lost, duplicated, or silently skipped — recoverable, but only by someone noticing"* |
| a wrong figure in prose that no criterion depends on | `cosmetic` — *"nothing breaks; a later reader might be mildly misled"* |

So the bar is `impactIfUnfixed >= broken` (`PREVENTION_IMPACT_BAR`, the same constant the prevention guard
already dials), requiring **zero** schema change. `impactIfUnfixed` is enum-constrained, null-prototype,
fail-loud and total — a level with no rank crashes the import rather than comparing as `undefined`. That is
the "typed field, not discretion" condition the amendment demanded, met by reuse.

> **Retracted — the field name.** This section, the heading above it, the ruling line at the top of this
> card, the anchor in `we:docs/agent/platform-decisions.md` and the `ADVISORY_LENSES` comment in
> `we:scripts/lib/jury-core.mjs` all used to name the typed field **`` `impact` ``** — as in *"the right axis
> is already typed, and it is `impact`"* and *"the bar is `impact >= broken`"*. **There is no `impact` field
> on a finding.** The field is `impactIfUnfixed` (`we:scripts/lib/jury-core.mjs:53`, normalized at `:384`,
> read by `blocksAcceptance` at `:532`); the named constants around it — `IMPACT_LEVELS`, `IMPACT_GLOSS`,
> `PREVENTION_IMPACT_BAR`, `impactStrictness` — were and are correct. Fixed everywhere, because `#x38ergj`
> asks a builder to read the level off a finding and the wrong name would not resolve. Where this card still
> says *impact* unbackticked it means the axis, not a field.

## What still has to be built

The panel already lets an **advisory** lens's finding block — `derivePanelVerdict` derives
`prevention-outstanding` from the whole findings list, gated on `blocksAcceptance(f, { bar })`. But that path
fires only for **resolved** findings owing an uncaptured guard; an *outstanding* advisory finding rides the
accept at any impact. So this ruling is not a constant move — it needs one more scan, filed as **`#x38ergj`**.
Until that lands, "ruled (c)" behaves on disk exactly like (b), which is why the two-stage wording above is
part of the ruling rather than a note on it.

**That new scan must NOT reuse `blocksAcceptance`, and the ruling means it.** `blocksAcceptance`
(`we:scripts/lib/jury-core.mjs:530`) opens with `if (!hasUncapturedPrevention(finding)) return false;` — it
is a *prevention* predicate that consults impact, not an impact predicate. Reusing it would let this card's
own worked example through: a juror finds a card's Done-when cites a `file:line` that does not exist,
declares `impactIfUnfixed: 'broken'`, names "the `check:standards` locus gate" as the prevention and sets
`preventionCaptured: true` because that gate already exists — captured guard, so `blocksAcceptance` returns
`false` and an above-bar finding rides the accept. The bar this ruling states is **unconditional on
prevention**: outstanding + `impactIfUnfixed >= PREVENTION_IMPACT_BAR`, fail-closed on undeclared. `#x38ergj`
carries that predicate verbatim and a Done-when case pinning the `preventionCaptured: true` path.

The blocking set is kept **explicit** (`claim-accuracy` only), not generalized to every advisory lens.
Whether `simplicity` and `standards-conformance` should block above the same bar is a larger call this item
does not own — filed as **`#x2iwy8f`**.

## Retracted — the figures this call was prepared on

The preparation landed by #1582 put option (a)'s case as *"the deterministic backstop measured 3 of 13
addressable findings"* and *"of 30 verdicts recording changes, roughly 24 were an operator raising this class
by hand"*, and used the first again under (b) as *"a class whose deterministic adjudication scores 3 of 13."*
**All three are retracted figures**, already corrected on `main` in `we:scripts/lib/jury-core.mjs` and in this
card's own retraction note above — the preparation restated them after the correction had landed. The measured
values are
**5 of 39** (12.8%) and a cross-tab of **27 of 92** cases, of which 37 recorded `changes`. Both corrections
point *toward* (a), not away — the backstop is weaker than stated, and this class accounts for 27 of 37
bounces. The ruling survives them because it never rested on the backstop's recall; it rests on what
unanimity over a prose-dominated finding population would block.

Likewise **not** load-bearing here: the two-round result on PR #1569 (nine wrong figures found, both
bouncing defects missed). It is one PR, and one PR cannot establish a lens's profile. It grounds the omission
seat in [#size-adds-reviewers-never-refuses](/backlog/3320/), which is the claim it can carry.

## What this does not settle

- **`#x2iwy8f`** — whether the impact bar should govern every advisory lens, making the mandatory/advisory
  split itself largely redundant.
- **Roster width — whether `claim-accuracy` is now *seated* by default.** Two fan-out lists deliberately stayed
  at four lenses (`REVIEW_PANEL_LENSES` in `we:scripts/lib/jury-ledger.mjs`, `LENSES` in
  `we:scripts/workflows/review-parked-prs.mjs`), each on the stated trigger *"widen when the promotion is
  ratified"*. **That trigger is now spent and must not be acted on** — the promotion was ruled *down*, so it
  will never arrive. Seating is a separate axis from the mandatory/advisory split: the two seated advisories
  (`simplicity`, `standards-conformance`) argue by parity for seating this one, against a cost of one
  fresh-context juror per review per round. Both comments were corrected to say so; the call itself is not
  taken here, and the lens needs a `REVIEW_LENS_CHARTER` entry before it could be seated anyway.
- **Nothing binds until the panel is wired.** `review-pr` runs one caller-chosen lens, so the split does not
  bind at all until `we:scripts/lib/judge-panel.mjs` (#3050) is live — itself blocked on #3158's tool-free
  seats. This ruling is recorded now so the promotion question is closed, not because anything waits on it.

## Done when

1. **Executable** — `npm run check:standards` passes with this item `status: resolved` and `codifiedIn`
   pointing at `#claim-accuracy-advisory-blocks-on-impact`, and `claim-accuracy` still appears in
   `ADVISORY_LENSES` (not `MANDATORY_LENSES`) in `we:scripts/lib/jury-core.mjs` with its
   advisory-pending-a-ruling comment replaced by the ruling.
