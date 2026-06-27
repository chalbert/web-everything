---
kind: story
size: 5
parent: "777"
status: resolved
blockedBy: []
dateOpened: "2026-06-20"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
tags: [dogfood, fui, badge, site-rework]
---

# Dogfood the backlog badges/chips onto FUI badge + filter-chip (transient-CE)

> **Resolved (batch-2026-06-26-1813-1208-1618) — taxonomy half delivered; interactive filter pills split to #1825.**
> With #1817 landed (the FUI `we-tag` in-document embed entry), migrated the **taxonomy** surfaces to FUI
> `<we-tag>`: `kindBadge`/`sizeBadge`/`tierBadge`/`tagsRow`/`metaBadge`/`unslicedBadge` in
> `we:src/_includes/backlog-badges.njk` now emit `<we-tag>` (categorical `(set,value)` mode, #1670), the
> per-value palette lives in `we:src/css/style.css` (keyed to both the pre-upgrade `we-tag[set][value]` and
> the post-upgrade `.fui-tag[data-cat-*]` so there's no shape/colour shift), and `we:src/_layouts/base.njk`
> cross-origin-imports `fui:embed/tag-in-document.ts` + calls `registerTagsInDocument()`. Browser-verified on
> the running :8080: all `<we-tag>` upgrade to `span.fui-tag`, no console error, palettes exact, pills render
> consistently. **Status surfaces** were already `<we-badge>` (#1598). The remaining **interactive filter
> pills** (`<we-filter-chip>`) are a cross-file `aria-pressed`/`.is-active` JS rewrite + live-interaction
> verification — a materially different, separable surface from the decorative taxonomy swap — so they were
> **split to #1825** (the body's earlier "keep the whole surface in one card" note assumed both halves were
> similar-effort span swaps; the traced tree showed the filter half is a 4-script interaction rewrite).
> Resolved as the badge/tag dogfood; the chip half rides #1825.

> **Pre-flight (batch-2026-06-26-1793-1697) — body below is stale; real state reconciled here.** Traced the live tree:
> - **Status surfaces — DONE.** #1598 (resolved) migrated the status badges to `<we-badge>` (`statusBadge`/`epicStatusBadge` in `we:src/_includes/backlog-badges.njk`), and `we:src/_layouts/base.njk` already cross-origin-imports `fui:embed/badges-in-document.ts` + calls `registerBadgesInDocument()`. The "no `fui:embed/badge-in-document.ts` exists" / "Parked — blocked-in-fact" notes below are obsolete (#1758 shipped it).
> - **Taxonomy surfaces (kind/size/tier/tags/meta) → `<we-tag>` — blocked-in-fact.** The stale `blockedBy: ["1669"]` was cleared (1669 delivered the `we-tag` *block*), but the real prerequisite is a FUI `we-tag` **in-document embed entry** (the analog of `badges-in-document`), which does **not** exist — so WE docs can't render `<we-tag>` transient-CE yet. Filed as **#1817**; re-pointed `blockedBy: ["1817"]`. The hand-rolled `kindBadge`/`sizeBadge`/`tierBadge`/`tagsRow`/`metaBadge`/`unslicedBadge` spans swap to `<we-tag>` once #1817 lands.
> - **Filter pills** (`we:src/backlog.njk` `data-*-chip` buttons) → `<we-filter-chip>` is the remaining status-half remnant; `filter-chip` is registered, but the pills are interactive controls wired to page filter JS (`aria-pressed` toggle), so the swap needs live verification against the running /backlog/ filter UI — keep within this card once #1817 unblocks the taxonomy swap so the whole surface migrates together. De-sized 8 → 5 (status badges already delivered by #1598).

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
