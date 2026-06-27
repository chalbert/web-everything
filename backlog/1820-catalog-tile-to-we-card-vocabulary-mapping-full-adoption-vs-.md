---
kind: decision
status: open
dateOpened: "2026-06-27"
tags: []
---

# Catalog-tile to we-card vocabulary mapping (full adoption vs shallow wrap)

The catalog tiles (`we:src/intents.njk`, `we:src/blocks.njk`, `we:src/design-systems.njk` + the `we:src/_includes/project-*.njk` includes) are clickable `<a class="…-tile" data-status data-haystack>` anchors carrying a bespoke per-status palette badge + dimension chips, whose `data-*` the in-page filter JS depends on. None of this maps to `we-card`'s self-replacing `<article>` / `title`+body model without a design call. The blocking fork for **#1607** and **#1608** (both re-pointed `blockedBy: ["1820"]`); the card counterpart to the badge/chip mapping fork #1621 settled for `<we-badge>`/`<we-filter-chip>`.

## What you decide

How the catalog tiles map onto FUI `blocks/card` (`<we-card>`, transient-CE mount per the #1621 rule-7 model):

- **A — Full adoption.** Tiles become real `<we-card>` instances; the bespoke per-status palette + dimension chips re-express as `we-card` slots/props, and the in-page filter JS is reworked to read off the card's model instead of the current `data-*`. Highest fidelity to the component, most work, drops the bespoke vocabulary.
- **B — Shallow wrap.** `<we-card>` provides only the outer frame; the existing `data-*` anchor + bespoke badge/chip vocabulary survive inside it, filter JS untouched. Cheapest, but the card is a cosmetic shell — little of `we-card`'s model is actually exercised (questionable dogfood value).

No default set — **unprepared** (Tier B: discuss, don't auto-build). `/prepare` to survey how #1621 resolved the analogous badge fork and bring a bold default to DoR. Resolving this unblocks #1607 + #1608 as clean migrations.
