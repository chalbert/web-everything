---
kind: story
size: 8
parent: "777"
status: open
blockedBy: ["1669"]
dateOpened: "2026-06-20"
tags: [dogfood, fui, badge, site-rework]
---

# Dogfood the backlog badges/chips onto FUI badge + filter-chip (transient-CE)

> **Repointed by #1621 (ratified 2026-06-23).** Mount model = transient custom element + runtime cross-origin import + SSR baseline, **not** Mode-C per-instance (we:docs/agent/platform-decisions.md#we-fui-embed-boundary rule 7). Split by intent: **status surfaces → `<we-badge>` / `<we-filter-chip>` buildable now**; **taxonomy surfaces (kind/tier/tags/size/meta) → `blockedBy` #1669** (the FUI `we-tag` block consuming the #1670 taxonomy provider). The status half doesn't need #1669 and could `/split` out. Link-pills (`blockerChip`/`childCircle`) stay native `<a>`. Sized 8 — a `/split` is warranted now that the status/taxonomy seam is explicit.

The concrete #777 slice for the badge surface the #778 inventory mapped: migrate the /backlog/ tile, Prioritisation table, and detail-page badges/chips from hand-rolled njk to the FUI badge + filter-chip components, rendered in-document via Mode-C. Groundwork is done — the badge vocabulary + macros are now a single shared seam (we:src/_includes/backlog-badges.njk + we:src/_data/backlogMeta.js, the #778 "one seam the migration consumes"), Mode-C in-document render shipped (#786), and the status-indicator/badge intent is ratified (#354).

**Parked — blocked-in-fact:** FUI must first expose the `badge` + `filter-chip` components (the #778 must-build gap, no open WE-side item) before the seam's internals can swap to render via them. Un-park once those exist. Scope: replace the macro bodies in we:src/_includes/backlog-badges.njk (and the filter pills in we:src/backlog.njk) with the FUI component calls, keeping the props = the backlogMeta vocabulary.

**Update (batch-2026-06-22-1615-1208):** #1603 resolved (FUI shipped `badge` + `filter-chip`), but working
the sibling #1598 revealed the swap carries a real design fork — the bespoke backlog vocabulary
(per-kind/per-status palette + the `blockerChip`/`childCircle` link-pills + `reasonPill`) has no equivalent
in FUI's 5-tone `we-badge`, and the mode-C "one shadow root per mount point" model doesn't obviously fit
~25+ tiny badges per page (no `fui:embed/badge-in-document.ts` exists). Re-pointed `blockedBy: ["1621"]`
(was the now-resolved #1603). Un-blocks when [#1621](/backlog/1621-badge-mode-c-migration-model-how-do-the-bespoke-we-docs-badg/)
picks the vocabulary mapping + mount model.
