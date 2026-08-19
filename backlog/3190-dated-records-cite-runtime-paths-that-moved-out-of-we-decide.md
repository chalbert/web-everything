---
bornAs: xep8b9o
kind: task
status: open
relatedTo: ["3154", "1245", "1246"]
scope:
  - "we:scripts/check-standards.mjs"
  - "we:src/_data/researchTopics/"
  - "we:src/_includes/research-descriptions/"
  - "we:backlog/"
  - "we:reports/"
scopeRationale: "The sweep half is inherently corpus-wide — it rewrites or annotates every dated record whose cited runtime path was sliced out of WE, and which records those are is exactly what #2821 gate 5's own scan determines. The four content directories are precisely the ones that scan already walks and that carry unresolvable hits: resolved decision items under we:backlog/ (this item names #1685/#1686/#1688/#1823), we:reports/, and the two research dirs. Excluding any would let the item close with records it identifies untouched. The one code file is where CITATION_GATES_ENFORCED lives, which fork 3 may flip from warn to error."
dateOpened: "2026-08-17"
tags: [constellation, placement, docs, citations, debt, zero-impl]
---

# Dated records cite runtime paths that moved out of WE — decide the convention, then apply it corpus-wide

## Digest

Every time a runtime family is sliced out of WE to Frontier UI (the #1246 *zero implementation* ruling), the
**dated records** that cited it are left pointing at a path this repo no longer has. #3154 hit this for the
router and deliberately did **not** rewrite them; that decision needs settling once and applying everywhere,
rather than being re-litigated per slice.

**Measured backlog.** The router slice alone leaves **41** unresolvable `we:blocks/router/…` code loci —
22 in `we:backlog/`, 14 in `we:reports/`, 3 in `we:src/_data/researchTopics/`, 2 in
`we:src/_includes/research-descriptions/`.

It joins a much larger standing corpus: **474** gate-5 findings in total, sitting in `we:backlog/` (273),
`we:reports/` (193) and the two research dirs (26). The other big relocation blocks are the renderers
families (~81), `webregistries` (~49), `webbehaviors` (~21), `webexpressions` (~20), `webvalidation` (~15),
the relocated bootstrap entry point (~15), the plug core (~14), `webguards` (~10) and the theme tokens
module (~10) — every one a family genuinely moved out of this checkout, which is what makes this a
relocation problem rather than a typo problem.

**Not all of it is relocation, though.** Roughly **70** of the 474 are ordinary stale or malformed
citations that no relocation convention would fix: paths under `we:src/_data/` (~32), assorted
`we:backlog/` loci (~18, some malformed — one cites a line range on an item id rather than on any file at
all), and ~16 line-drift hits where the file exists but the cited line is past its end. Fork 1's
convention does not address those; they are incidental cleanup the sweep picks up.

Sizing the two research dirs concretely, since that set is the one most likely to be mistaken for pure
relocation debt: of their 26 hits, **5** are this change's own router loci (already counted in the 41
above), **5** are the renderers families, and the remaining 16 are the grab-bag just described. Earlier
slices therefore account for at most ~21 there — not 26.

All of it is currently *warn*-level, which is exactly why it has accumulated unnoticed.

## Why in-place repointing is the wrong reflex

The obvious fix — rewrite `we:` → `fui:` — is worse than it looks, and #3154 is the worked example:

- A research summary is a **date-stamped verification snapshot** (it carries `dateOpened`, `lastReviewed`,
  `reviewHorizon`). On its own date the code genuinely *was* at the `we:` path. Rewriting the prefix makes
  the record assert something untrue as of the date it claims to speak for.
- FUI's copy is **materially different code**, so a repointed citation can become factually **wrong**, not
  merely relocated. Concretely: several records describe `parseRouteDefinitions` reading a
  `route:guard:leave` attribute. That was true of the WE copy; FUI renamed it to `route:guard-leave` in
  #1991/#2048. Repointing turns a true-of-WE statement into a false-of-FUI one.

## The residual this leaves

#3154 repointed only **live, forward-looking** surfaces (statute, the published standard page, a conformance
vector, a code header) and left the dated records alone — deliberately, and consistently across the whole
dated set. So this is **not** a half-finished rewrite: the four router research-descriptions and three
researchTopics summaries all still say `we:`, as do the equally-historical resolved decision records
#1685 / #1686 / #1688 / #1823.

The residual is simply that the dated set as a whole now cites paths this repo does not have, and every
future slice widens it. Also in the inventory when the sweep runs:

- **#1834 versus its own generated artifact.** `we:backlog/1834-*.md` cites
  `we:blocks/router/behaviors/RouteLinkBehavior.ts`, while the seam vector that item authored
  (`we:blocks/renderers/composition/__fixtures__/composition-seam-cases.ts`) was repointed to `fui:` as a
  live surface. That is the one case where a record and the artifact it produced now disagree.
- **Two stale line numbers in statute.** `we:docs/agent/platform-decisions.md` cites
  `fui:blocks/router/elements/RouteViewElement.ts:48` for the `routes` getter (actually 64) and `:498` for
  the clone site (actually 599). Both pre-date #3154 and were left alone rather than widening a statute
  edit, but they belong to this item's citation-hygiene remit.

## What to settle

1. **The convention.** Leading candidate: leave the dated prose intact and attach a **dated relocation
   note** (or a typed `codeRefsRelocated` field) — "the cited runtime moved to `fui:…` on <date> (#NNNN)".
   That keeps the record true as of its date while still routing a reader to the code.

   The alternative — complete in-place repointing — is defensible but has a **precondition** the piecemeal
   version cannot meet: it must be *complete*. These records pair a full path with bare `<file>:<line>`
   shorthand later in the same sentence, so repointing only the path silently rebinds that shorthand to a
   file where the line means something else. Any repointing convention therefore has to strip or re-measure
   every stale line number and correct every claim that no longer holds of FUI, in one pass. That is a
   corpus-wide job, which is why #3154 declined to start it one slice at a time.
2. **The sweep.** Apply the settled convention to the whole affected set — not just router, but every
   family already sliced under #1245 / #1246, across all four scanned directories: `we:backlog/`,
   `we:reports/`, `we:src/_data/researchTopics/`, and `we:src/_includes/research-descriptions/`.
3. **Warn or error — the gate already sees all of this.** There is nothing to *add* to the scan. #2821
   gate 5 in `we:scripts/check-standards.mjs` already walks `backlog/`, `reports/`, `docs/agent/`,
   `agent-memory-src/`, `src/_data/researchTopics/` **and** `src/_includes/research-descriptions/`, and it
   already fires on the research dirs today for other sliced families. The real open question is the flag
   the code itself flags: **`CITATION_GATES_ENFORCED=false`**, which keeps gate 5 at *warn* because "the
   historical corpus carries many pre-gate hits". So the decision is **warn → error**, and the sweep in
   fork 2 is the prerequisite that makes flipping it possible.

   Sizing that flip: #3154 alone contributes **41** of the blockers (22 `we:backlog/`, 14 `we:reports/`,
   3 researchTopics, 2 research-descriptions), on top of the pre-existing corpus.

## Done when

1. **Executable** — the chosen convention is written down under `we:docs/agent/` (so the next slice follows
   it without re-deciding), and `npm run check:standards` reports **zero** #2821 gate-5 *"does not resolve"*
   findings **whose cited path is a runtime family relocated out of WE** — the ~400 of the current 474 that
   are this item's actual remit. The gate produces the inventory itself (no hand-maintained list); the
   filter is "does this path exist in a sibling constellation repo".

   The ~70 that are **not** relocations — ordinary stale paths under `we:src/_data/`, malformed
   `we:backlog/` loci, and line-drift past end-of-file — are explicitly **out of scope for the Done-when**.
   Fix them opportunistically while sweeping, but do not let them hold this item: they need per-citation
   judgment, not a convention, and pretending one number covers both is how this item would stall.
   Flipping `CITATION_GATES_ENFORCED` to error is fork 3's call and does require the absolute zero, so if
   that flip is taken in the same change the residual ~70 must be cleared as its own step.
