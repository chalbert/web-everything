---
kind: story
size: 5
parent: "1585"
status: open
blockedBy: []
dateOpened: "2026-06-22"
preparedDate: "2026-08-15"
tags: []
---

# Distillation pipeline — curated weighted sources into codified rubric heuristics with provenance (single-source axes)

The content-distillation track of the design-knowledge intake program (#1585): distill curated, weighted
admitted sources into the #1034 design-critique rubric as codified heuristic **guidance content**
(AI-authored, original wording — never raw source text copied), carrying provenance back to the source. This
is distinct from the citation-only provenance the v2 rubric already carries (#1587): a table cell naming
*which* source grounds an axis is not itself a codified heuristic, it is an index. **Scoped to the 4 axes
backed by exactly one admitted source**; the 4 multi-source axes are deferred to a follow-on
(`#3116` — "Distillation pipeline — multi-source rubric axes into codified heuristics") because they need
a source-reconciliation call this item does not.

## Blocker status (verified against live state, 2026-08-15)

Both listed blockers are cleared in substance; `blockedBy` above is now `[]`:

- **#1591** (credibility-weighting meta-schema) — `status: resolved` (2026-06-22), shipped as
  `we:src/_data/credibilityWeighting.js` (`admit`, `computeCredibilityWeight`, the `*Default` meta-schema).
- **#490** is an epic still `status: open`, but only for slices this item never touches: `#513` (train +
  quantize the on-device image classifier) is `parked` on a corpus-volume `maturityTrigger`, and `#514`
  (WebGPU provider) is `blockedBy: ["513"]`. The slice #1589 actually depends on — `#511`, the versioned
  "distillation recipe" format/pattern epic #490 needed to exist as prior art for the no-leakage discipline —
  is `status: resolved` (2026-06-14; `we:design-refs/distillation-recipe.json`). Nothing #1589 needs is still
  gated by #490's open remainder.

## Decided design — why real guidance content, not a ledger-flip

The parent epic's own review log frames the remaining work as "distill the seed set and flip its
`distilledInto` rows." Read narrowly, that could mean: treat the v2 axis→source **citation** already in
`we:docs/agent/vision-tiers.md` (e.g. axis 5 ← `nielsen-heuristics`) as "distilled," snapshot each ledger
row's `credibilityWeight`, and flip `distilledInto`. **Rejected** — that is a provable no-op of the same
shape the prep checklist's item 9 flags (#3004/#3095): the conformance NUDGE would go green
(`we:scripts/check-standards-rules.mjs` `computeDesignKnowledgeConformance`) but nothing consumed downstream
(#1035's `/review-design` skill, #1036's correction surface, #1553's judge priors) would change, because a
citation says *which* source grounds an axis, never *what to look for*. #1034's own grounding for requiring
a rubric at all is UICrit's finding that raw zero-shot VLM critique is ~13% valid and a rubric **+ few-shot
grounding** is what makes it usable — a bare citation supplies no grounding content. #1553's ruling frames
the deliverable the same way: "rubric entries carrying provenance," not an index of entries.

**Decided:** author real, short, AI-synthesized (never verbatim) distilled-guidance content per axis, added
to `we:docs/agent/vision-tiers.md` as a new prose subsection (not a new JSON data artifact — #1592 already
found the sibling `we:src/_data/credibilityWeighting.js` mechanism has **zero production consumers** once
built speculatively; #1035, the actual machine consumer of rubric content, does not exist yet, so a second
structured-data home for the same content would repeat that mistake. When #1035 lands it either parses this
doc section or a build-time call at that point decides a data shape — not this card.), then flip the
ledger's `distilledInto`.

**Scope-narrowing (this item vs the follow-on):** of the 8 rubric axes, 4 are backed by exactly one admitted
source and 4 by two:

| # | Axis | Provenance | Sources | This item? |
|---|---|---|---|---|
| 1 | Contrast & legibility | `w3c-apg` | 1 | **yes** |
| 2 | Spacing & rhythm | `apple-hig` | 1 | **yes** |
| 4 | Typographic scale | `apple-hig` | 1 | **yes** |
| 5 | Consistency / token use | `nielsen-heuristics` | 1 | **yes** |
| 3 | Alignment & structure | `apple-hig`, `nielsen-heuristics` | 2 | no → `#3116` |
| 6 | Grouping & proximity | `apple-hig`, `uicrit-uist24` | 2 | no → `#3116` |
| 7 | Visual hierarchy & emphasis | `uicrit-uist24`, `apple-hig` | 2 | no → `#3116` |
| 8 | Aesthetic polish / craft | `apple-hig`, `uicrit-uist24` | 2 | no → `#3116` |

A multi-source axis needs a reconciliation call this item's pattern doesn't cover — how the #1588
credibility weight orders/blends two sources whose guidance could overlap or conflict (e.g. `apple-hig`
0.75 vs `uicrit-uist24` 1.0 both grounding axis 6) — so it is out of scope here, carried by `#3116`
(`blockedBy: ["1589"]`, since it extends this item's v3 pattern to v4). This item alone distills 3 of the 4
ledger rows (`w3c-apg`, `apple-hig`, `nielsen-heuristics`); `uicrit-uist24` stays `distilledInto: null` here
— explicitly deferred, not forgotten (its `trackingItem` moves from `"1589"` to `"3116"`).

## Interfaces / protocol

**1. `we:docs/agent/vision-tiers.md`** — version bump `v2` → `v3` (additive; #1034 Fork 3's version-bump
escape hatch, same mechanism #1587 used for v1→v2). Add a new subsection directly below the existing axis
table, e.g. `### Distilled guidance (v3)`, with one short paragraph per axis 1/2/4/5. Each paragraph must:
name the specific sub-principle of its source it synthesizes (not the source's title alone — e.g. Nielsen's
*numbered* heuristic, the specific WCAG/APG success criterion, the named HIG section), state it in original
wording, and say what a critique should concretely flag. Axes 3/6/7/8 get a one-line placeholder ("pending —
multi-source, tracked by `#3116`") so the doc never silently implies full coverage. Worked example to
calibrate depth/tone (axis 5, `nielsen-heuristics`):

> **5 — Consistency & token use.** Codified from Nielsen's heuristic #4, *Consistency and standards*: the
> same concept should carry the same word, icon, or design token everywhere it appears, and interactions
> should follow platform convention rather than inventing a bespoke one without reason. Flag: two elements
> serving the same role (e.g. two "primary action" buttons) styled from different color/spacing tokens; a
> control whose interaction pattern diverges from the platform norm with no stated reason.

**2. `we:src/_data/designKnowledgeWatch.json`** — no schema change, only value edits to the existing
`distilledInto` / `trackingItem` fields (`isDistilled()` in `we:scripts/check-standards-rules.mjs:330`
already accepts a non-empty array). Set:
- `w3c-apg.distilledInto` → `["we:docs/agent/vision-tiers.md#design-critique-rubric-ratified-1034 v3 axis 1 (Contrast & legibility)"]`
- `apple-hig.distilledInto` → the two-entry array for axes 2 and 4 (same reference shape)
- `nielsen-heuristics.distilledInto` → the one-entry array for axis 5
- `uicrit-uist24.trackingItem` → `"3116"` (was `"1589"`); `distilledInto` stays `null`

**3. `we:src/_data/credibilityWeighting.js`** — no code change. Verified: every affected row's committed
`credibilityWeight` already recompute-matches `computeCredibilityWeight({kind: row.kind}).weight` with no
modifiers (`w3c-apg` standard→0.9, `apple-hig`/`nielsen-heuristics` guideline→0.75, `uicrit-uist24`
peer-reviewed→1.0 — all match today's literals). This item **locks that invariant in with a test** rather
than changing values, which is also the first production-shaped exercise of `computeCredibilityWeight`
against real ledger data (#1592 found it had zero callers outside its own unit test).

**4. New test — `we:scripts/__tests__/design-knowledge-distillation.test.mjs`** (import
`we:src/_data/designKnowledgeWatch.json`, `we:src/_data/credibilityWeighting.js` via `createRequire`, and
`computeDesignKnowledgeConformance` from `we:scripts/check-standards-rules.mjs`):
- each of `w3c-apg` / `apple-hig` / `nielsen-heuristics` has a non-empty `distilledInto` array
- `uicrit-uist24` still has `distilledInto: null` and `trackingItem === "3116"`
- each row's committed `credibilityWeight` equals `computeCredibilityWeight({kind: row.kind}).weight`
- `computeDesignKnowledgeConformance(watch)` returns `{ total: 4, distilled: 3, pending: 1, pendingList: ['uicrit-uist24 (#3116)'] }`

## Tasks (ordered)

1. Author the 4 distilled-guidance paragraphs in `we:docs/agent/vision-tiers.md` (axes 1, 2, 4, 5),
   version-bump to v3, add the axes-3/6/7/8 pending placeholder.
2. Flip `distilledInto` on the `w3c-apg` / `apple-hig` / `nielsen-heuristics` rows of
   `we:src/_data/designKnowledgeWatch.json`.
3. Update `trackingItem` on the `uicrit-uist24` row to `"3116"`.
4. Write `we:scripts/__tests__/design-knowledge-distillation.test.mjs` per the four assertions above.
5. `npx vitest run we:scripts/__tests__/design-knowledge-distillation.test.mjs` green.
6. `npm run check:standards` — confirm the design-knowledge NUDGE now reads `3/4 distilled … pending:
   uicrit-uist24 (#3116)`, 0 errors.

## Done when

- [ ] `we:docs/agent/vision-tiers.md` rubric is `v3`; axes 1/2/4/5 each carry an original-wording
      distilled-guidance paragraph naming its source's specific sub-principle; axes 3/6/7/8 carry the
      pending placeholder citing `#3116`.
- [ ] `we:src/_data/designKnowledgeWatch.json`: `w3c-apg` / `apple-hig` / `nielsen-heuristics` rows have
      non-empty `distilledInto`; `uicrit-uist24` row unchanged except `trackingItem: "3116"`.
- [ ] `we:scripts/__tests__/design-knowledge-distillation.test.mjs` exists and is green, pinning the exact
      `{ total: 4, distilled: 3, pending: 1 }` conformance shape.
- [ ] `npm run check:standards` — 0 errors, design-knowledge NUDGE reads 3/4 distilled.

## Delivery shape

Doc + data + one new test file; no runtime/code-path surface touched, additive-only (version bump, not
breaking). Lands as **one incremental PR** behind `main` — no branch-splitting needed.

## Relationships

- **parent #1585** — design-knowledge intake program; this is its content-distillation track.
- **`#3116`** — the multi-source-axis follow-on this item defers to (`blockedBy: ["1589"]`).
- **#1586 / #1587 / #1588 / #1591** — the ledger, rubric-provenance, weighting-decision, and
  weighting-meta-schema siblings this item consumes; all resolved.
- **#1035 / #1036 / #1553** — downstream consumers of the distilled guidance content (not yet built; this
  item's doc-only placement is deliberately cheap to repoint once they land).
