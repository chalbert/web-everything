---
kind: story
size: 3
parent: "866"
status: resolved
blockedBy: []
dateOpened: "2026-06-22"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: none
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

## Done (2026-06-24) — status surfaces migrated to `<we-badge>`; verified on the live board

The #1758 loader resolved (`<we-badge>`/`<we-filter-chip>` registered on the docs site via the cross-origin
import in we:src/_layouts/base.njk), so the **status half** of the #1621 mapping is now buildable and
shipped. The three Status-Indicator macros in we:src/_includes/backlog-badges.njk now emit `<we-badge>`
(tone on the closed 5-tone enum; bespoke inline-style spans deleted):

- **`statusBadge`** → `<we-badge tone>` — open→warning, active/preparing→info, resolved→success, else→neutral
  (purple `preparing` folded into `info`; the "Prepping" label keeps the distinction).
- **`epicStatusBadge`** → its three direct spans (ongoing program→info, all-slices-done→success,
  ⚠ N-open-slices→error+`icon`) become `<we-badge>`; the childless branch keeps delegating to
  `unslicedBadge` (taxonomy, out of scope).
- **`reasonPill`** → the five non-link holds (stop-the-world/human-gate/blocked→error, parked→warning,
  priority-low→neutral) become `<we-badge>` with the ⊗/⏸/▽ glyph in the badge `icon=` slot; tooltips ride
  the `title` attribute (TransientElement copies non-config attrs onto the upgraded span). The
  `project-pending` branch is a LINK and stays a native `<a>` (the #1621 link-pill rule).

**Verified:** `npm run verify` (11ty build clean; check:standards 0 errors — the 2 vitest reds are a
pre-existing `we:scripts/backlog.mjs` git-guard source-match, unrelated) + a real-browser check on the
running :8080 board with FUI :3001 live — **0 un-upgraded `<we-badge>` left, all 1910 upgraded to
`<span class="fui-badge fui-badge--TONE">`, 144 icon glyphs rendered, no console errors.** The SSR baseline
(`we-badge[tone]` in we:src/css/style.css) styles the pre-upgrade pills (no FOUC).

**Out of scope / remainder (tracked under sibling #1208, the broader badges/chips dogfood):**
the **taxonomy** macros (`kindBadge`/`tierBadge`/`tagsRow`/`sizeBadge`/`metaBadge`/`unslicedBadge`) →
`<we-tag>` need a we-tag docs loader (the #1758 analog for the Tag block; not yet built) + the #1670
taxonomy provider; and the **interactive filter chips** in we:src/backlog.njk → `<we-filter-chip>` need the
client-side filter JS (we:src/assets/js) rewired off `data-*-chip`/`aria-pressed` onto the FUI element —
both bigger than this size-3 and squarely #1208's territory. Link-pills (`blockerChip`/`childCircle`) stay
native by the #1621 ruling. Resolving #1598 for the delivered Status-Indicator surfaces.
