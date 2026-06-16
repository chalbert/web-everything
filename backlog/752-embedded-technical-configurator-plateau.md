---
type: idea
workItem: story
size: 13
status: open
parent: "746"
locus: webeverything
dateOpened: "2026-06-16"
relatedProject: webdocs
crossRef: { url: /backlog/079-render-strategy-toggle-ui/, label: "Render-strategy toggle (#079)" }
tags: [webdocs, block-explorer, plateau-embed, technical-configurator, render-strategy, chunks, transport]
---

# Embedded technical configurator (Plateau embed) — configure a block's technical aspects, with a cost preview

Add a **"Configure technical aspects"** button on the block page that opens an **embedded mini technical configurator** (a Plateau Technical Configurator embed) scoped to *this block* — render strategy (SSR/CSR/hydration, building on the in-block toggle #079), delivery transport (#455), trait lazy-loading (#448), and chunk splitting (#719/#720). It **deep-links to the full Plateau Technical Configurator** for the project-wide decision. Make the tradeoff visible: show the **resulting chunk graph + an estimated bytes / requests / hydration-cost preview** for the chosen config, so the choice is concrete rather than abstract.

## Build

- "Configure technical aspects" button → embedded mini configurator (Plateau embed) seeded with this block's technical dimensions.
- Surface the dimensions: render strategy (#079), transport (#455), trait lazy-load (#448), chunk split (#719/#720) — cross-ref existing Configurator domains, don't duplicate.
- Cost preview: chunk graph + estimated bytes/requests/hydration for the selected config.
- Deep-link to the full Plateau Technical Configurator for the project-level call.

## Acceptance

- [ ] The button opens the per-block configurator and the deep-link reaches the full Plateau one.
- [ ] Changing a technical setting updates the chunk-graph / cost preview.
- [ ] A fixture exercises at least one non-default technical config on a block.

## Notes

Per intent-UX-only / technical→Configurator: these are technical settings, never UX dimensions on the block and never a WE mandate.

## Outgrew + false premise — found mid-work (2026-06-16, batch-2026-06-16); resized 3 → 13, needs /slice + a decision

Claimed in a batch and traced the real surfaces before building. The "not hard-blocked, the
dimensions already have homes as Configurator domains, deep-links to the existing tool" framing is
**wrong** — three load-bearing premises don't hold against the tree:

1. **The Plateau Technical Configurator has exactly ONE domain — Change Tracking**
   (`plateau-app/src/technical-configurator/configurator.ts`, README: *"The first (and currently only)
   domain is Change Tracking"*). Render-strategy (#079), transport (#455), trait-lazy-load (#448), and
   chunk-split (#719/#720) are **not** existing Configurator domains — they are WE-side concepts. So
   "reuse existing domains, don't duplicate" is impossible: each of the four must be **built as a new
   Configurator domain** (a `seed-*.ts` + axis data + provider entry) first.
2. **No embed/seed mechanism exists.** `mountTechnicalConfigurator(root)` takes no seed and reads no
   URL params; there is no Plateau→WE embed transport (the FUI `fuiDemo` iframe is FUI-only). How WE
   embeds a Plateau SPA view *seeded with a block's dimensions* is an undecided cross-repo seam — a
   **design fork** (iframe + query-param seed contract? a shared component? deep-link only?), analogous
   to the #700/#701 WE↔FUI boundary ruling.
3. **No cost model exists.** "estimated bytes / requests / hydration-cost preview + chunk graph" is a
   whole cost-estimation design (what's the input, what's the fidelity) — nothing computes it today.

**Action:** released unworked, size bumped **3 → 13** (epic-shaped). Needs a `/slice` into: (a) the four
new Configurator domains, (b) a **decision** on the Plateau↔WE embed/seed transport, (c) the cost-model
design, (d) the WE block-page button + deep-link. Don't batch it until those land.
