---
kind: epic
status: open
locus: frontierui
relatedProject: webcomponents
dateOpened: "2026-07-01"
tags: [packaging, transient-element, wrapper, migration, frontierui]
---

# FUI: migrate transient blocks to wrapper-first (#1962) — review + convert current TransientElement usages

Ratified #1962 (2026-07-01): the block catalog is wrapper-first — transient (self-erase) is reserved for content-model-constrained native children only, and no current block qualifies. Migrate every current TransientElement subclass in FUI: presentational leaves to persistent light-DOM (the soft-7 slice is #1974, under #1963), single native controls to a persistent wrapper containing a real native control (Shoelace <sl-input> shape) — carved as child slices #2120–#2126 by the 2026-07-02 split (we:reports/2026-07-02-backlog-split-analysis.md). Also harden the retained reserved-case TransientElement with the missing isConnected guard (#1961 rider). Locus: frontierui.

## Scope & slicing (carved 2026-07-02)

**Audit done (2026-07-02 split analysis).** The authoritative census is **14 concrete transients** (grep `extends TransientElement` / `extends TemporalTransientElement` in `fui:blocks/`): the soft-7 (badge, tag, card, section-card, auto-heading, meter, progress — #1974's scope, base class + badge pilot per resolved child #2028) plus filter-chip, button, text-field, number-input, and the 3 temporal presets (`fui:blocks/temporal/TemporalTransientElement.ts:40-52`). Corrections vs the original #1963-audit list: **no color/file pickers exist**; **filter-chip is a single native control** (`fui:blocks/filter-chip/FilterChipElement.ts:39-46` resolves to a native `<button>`), so it migrates in the wrapper family (#2122), not as a #1974 leaf; **#2009 resolved 2026-07-01** (shipped before the migration — the supersede contingency is settled; it stands as the near-term mitigation).

**Slices:**
- **#2120** (task, unblocked) — reserved-mechanism hardening: the `isConnected` guard at `fui:blocks/transient/TransientElement.ts:75` (#1961 rider third leg).
- **#2121** (story·2, blockedBy #1974) — button → persistent wrapper.
- **#2122** (story·2, blockedBy #1974) — filter-chip → persistent wrapper (preserve the #1961 value/aria-pressed surface).
- **#2125** (story·3, blockedBy #1974) — text-field + number-input → persistent host (both already build `<div>…<input>` via their factory; keep single-renderer parity).
- **#2124** (story·3, blockedBy #1974) — temporal presets → persistent wrapper (trait attributes forward to the inner native input).
- **#2126** (task, blockedBy #2122, locus webeverything) — WE chip-consumer cleanup + re-scope the prepared #1960 card to the reserved case.

All wrapper slices ride behind **#1974** (it lands the #2028 persistent base class + badge pilot; kept under #1963 — cross-epic edge by pointer, not re-parent). #2121/#2122/#2124/#2125 are disjoint block dirs, parallel-batchable once #1974 lands.

Finite burndown epic — Definition of Done: after #1974 + #2120–#2126, zero concrete subclasses remain transient; `TransientElement` retained (hardened) for the genuine content-model-child reserved case.
