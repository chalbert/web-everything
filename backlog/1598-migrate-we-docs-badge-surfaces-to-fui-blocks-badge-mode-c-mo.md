---
kind: story
size: 3
parent: "866"
status: open
blockedBy: ["1748"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-24"
tags: []
---

# Migrate WE-docs badge surfaces to FUI blocks/badge (transient-CE dogfood)

Migrate the ~25 badge surfaces across we:src/*.njk + we:src/_includes to FUI blocks/badge via the **transient custom element** (`<we-badge>` / `<we-filter-chip>`) — registered once + emitted server-side + upgraded in place, *not* a per-instance mode-C shadow mount (#1621 ruling, we:docs/agent/platform-decisions.md#we-fui-embed-boundary rule 7). Gate npm run verify + a :8080 render check.

## Resolved by #1621 (ratified 2026-06-23) — split into a status half (now) + a taxonomy half (blocked)

#1621 ruled the mount model (transient CE + cross-origin import + SSR baseline, **not** per-instance mode-C — the old "mode-C inline SDK" title is retired) and split this work by intent:

- **Status surfaces — buildable now:** `statusBadge` / `epicStatusBadge` / `reasonPill` → `<we-badge>` (Status Indicator), plus the interactive filter chips → `<we-filter-chip>`. No further dependency.
- **Taxonomy surfaces — `blockedBy` #1669:** `kindBadge` / `tierBadge` / `tagsRow` / `sizeBadge` / `metaBadge` consume the categorical-taxonomy provider (#1670) via the FUI `we-tag` block (#1669) — hence the `blockedBy: ["1669"]` edge above. **The status half does not need #1669** and could be split out (`/split`) to build ahead of the taxonomy provider.
- **Link-pills** (`blockerChip` / `childCircle`) stay native `<a>`.

## Pre-flight (batch-2026-06-22-1596-1593) — buried dependency on #1603; not a ready 3

The ~25 surfaces are `badge` **and** `filter-chip` (the `we:src/_includes/backlog-badges.njk` macros + the
Prioritisation chips). FUI ships `fui:blocks/badge/` but **not** `fui:blocks/filter-chip` — and the central
`we:src/_includes/backlog-badges.njk` dogfood-seam note states the macro swap waits on "FUI shipping
`badge`/**`filter-chip`**". That component is exactly what **#1603** builds. So this migration is
**blocked-in-fact** until #1603 ships both components — encoded as `blockedBy: ["1603"]` (was a missing
edge). Released from batch-2026-06-22-1596-1593 unbuilt. Un-blocks the moment #1603 resolves; then verify
the inline mode-C render path also covers many-small-component mounts (the `#765/#728` half of the seam note).

## Re-flight (batch-2026-06-22-1615-1208) — #1603 resolved, but a buried design fork → blockedBy #1621

Claimed after #1603 resolved (FUI shipped `badge` + `filter-chip`), then read the real FUI tree
(`fui:embed/`, `fui:blocks/badge/BadgeElement.ts`): the "flat application" framing hid **two entangled
design calls**, so this is **not** a flat 3 — re-pointed `blockedBy: ["1621"]` (the
[#1621](/backlog/1621-badge-mode-c-migration-model-how-do-the-bespoke-we-docs-badg/) decision) and
released unbuilt. The forks (full detail in #1621): **(1)** the ~10 bespoke `we:src/_includes/backlog-badges.njk`
macros (per-kind/per-status palette, plus the `blockerChip`/`childCircle` `<a>` link-pills and `reasonPill`)
have **no equivalent** in FUI's 5-tone (`neutral|info|success|warning|error`) transient `we-badge`; **(2)**
mode-C (`fui:embed/in-document.ts`) mounts **one shadow root per mount point** and **no
`fui:embed/badge-in-document.ts` module exists** — ~25+ shadow roots/page is the unverified
"many-small-component mounts" residual the original pre-flight flagged. Un-blocks when #1621 picks the
vocabulary mapping + the mount model (its default leans to the transient `<we-badge>` custom element, which
would re-frame this card's "mode-C inline SDK" requirement).

## Re-scope finding (batch-2026-06-23-1725-1665) — blocked-in-fact on the docs loader; `blockedBy: 1748`

Both component blockers cleared (#1669 we-tag + #1603 FUI filter-chip both resolved — FUI ships `fui:blocks/badge/` + `fui:blocks/filter-chip/` with their transient elements). But working it surfaced the real crux: the **WE docs site has no mechanism to load + register the FUI transient elements**. Verified — `we:src/_layouts/base.njk` loads only local `we:src/assets/js/*.js`; there is no `@frontierui` import, no `registerBadge`/`registerFilterChip`, no cross-origin FUI bundle, no `customElements.define` for any `we-*` in the docs runtime, and no precedent. So an emitted `<we-badge>` would never upgrade (unstyled unknown element).

#1621 ratified the transient-CE *model* but not the *loader* its "registered once" clause needs on the WE docs site — and that loader carries a production-viability fork (bundle a WE→FUI build edge vs cross-origin import vs defer until a published `@frontierui` component package). Filed as **#1748** and re-pointed `blockedBy: 1748`; set back to `open`. Not pure-agent buildable until the docs-loader mechanism is decided + built; `/batch` declined it as blocked-in-fact and released the claim.
