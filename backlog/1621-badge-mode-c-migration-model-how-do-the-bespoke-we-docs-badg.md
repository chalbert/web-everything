---
kind: decision
parent: "866"
status: open
dateOpened: "2026-06-22"
tags: []
---

# Badge mode-C migration model: how do the bespoke WE-docs badge surfaces map to FUI's 5-tone badge, and what mount model fits many-small-components?

Blocks #1598 (migrate WE-docs badge surfaces → FUI badge mode-C) and #1208 (dogfood backlog
badges/chips → FUI badge + filter-chip). Surfaced in batch-2026-06-22-1615-1208 after #1603 shipped the
FUI `badge`/`filter-chip` components: claiming #1598 and reading the real FUI tree revealed the
"flat application" framing hid two entangled design calls, so the badge migration cannot be built
without a ruling.

## What you have to decide

**(1) Vocabulary mapping.** `we:src/_includes/backlog-badges.njk` is the single source of truth for ~10
badge/chip/circle macros: `kindBadge` / `statusBadge` / `sizeBadge` / `tierBadge` / `unslicedBadge` /
`epicStatusBadge` / `metaBadge` / `tagsRow` / `childCircle` / `blockerChip` / `reasonPill`. Each renders a
**bespoke per-kind/per-status palette** (story=#dbeafe/#1e40af, epic=#ede9fe/#5b21b6, …) with tooltips,
and several are **not badges at all** — `blockerChip` and `childCircle` are `<a href>` link pills/circles,
`reasonPill` is a conditional icon pill. FUI's `we-badge` (`fui:blocks/badge/BadgeElement.ts`, transient
Mechanism-A) offers only `tone ∈ {neutral,info,success,warning,error}` + `icon` + `status`. **The bespoke
backlog palette + the link-pills/circles have no FUI-badge equivalent.** Options: (a) extend FUI `we-badge`
with the backlog vocabulary (FUI change — risks a docs-specific palette leaking into the shared component);
(b) migrate only the surfaces that map to existing tones, leave the rest hand-rolled (partial dogfood —
which surfaces?); (c) a config-driven generic badge accepting arbitrary bg/fg (defeats the tone system /
minimize-lock-in). **Default (b)** — migrate the tone-mappable subset, keep the link-pills/circles native.

**(2) Mount model for many-small-components.** Mode-C (`fui:embed/in-document.ts`, #786/#765) mounts **one
shadow root per mount point**, each dynamically importing a module that exports `mountInDocument` — and
**no `fui:embed/badge-in-document.ts` / `fui:embed/filter-chip-in-document.ts` module exists** (only
`fui:embed/chrome-in-document.ts`). The chrome is ONE big mount; a backlog tile carries ~6 badges and a
page lists hundreds — ~25+ shadow roots + dynamic imports **per page**. This is exactly the "does the
inline mode-C render path cover many-small-component mounts?" residual the #1598 pre-flight + the #765/#728
seam note flagged. Options: (a) per-badge mode-C shadow mounts (simple, but N shadow roots/page — perf +
a11y cost); (b) register the `we-badge` **transient custom element** once and emit `<we-badge>` in the njk
(no per-badge SDK/shadow — but not "mode-C inline SDK" as #1598's title says); (c) a single batched
registry-mount that upgrades all badge mount points in one pass. **Default (b)** — transient custom
elements are the lightest dogfood for many tiny presentational badges; reserve mode-C shadow mounts for
heavy/interactive components (the chrome). This likely **re-frames #1598's "mode-C inline SDK" requirement.**

## Why this is a fork, not a build

Both sub-calls pick an **end-state** (which component surface owns the backlog vocabulary; which mount
model the docs use for many small components) that reshapes FUI and/or the WE-docs build — not effort.
Resolving it unblocks #1598 + #1208; a follow-up may also file the missing
`fui:embed/badge-in-document.ts` / `fui:embed/filter-chip-in-document.ts` FUI modules **iff** option (2a)
wins.

Lineage: parent #866 (WE-docs FUI-chrome dogfood), sibling of the #867/#868/#869 replay slices, and the
#777/#778 backlog-badge dogfood (#1208). Pre-flight `[[feedback_prep_verify_mechanism_has_consumer]]` /
`[[feedback_misflagged_batchable_fix_real_state]]`: read the real FUI tree before assuming a flat mount.
