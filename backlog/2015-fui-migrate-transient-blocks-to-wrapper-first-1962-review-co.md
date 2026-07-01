---
kind: epic
size: 13
status: open
locus: frontierui
relatedProject: webcomponents
dateOpened: "2026-07-01"
tags: [packaging, transient-element, wrapper, migration, frontierui]
---

# FUI: migrate transient blocks to wrapper-first (#1962) — review + convert current TransientElement usages

Ratified #1962 (2026-07-01): the block catalog is wrapper-first — transient (self-erase) is reserved for content-model-constrained native children only, and no current block qualifies. Review every current TransientElement subclass in FUI (badge, tag, card, section-card, auto-heading, meter, progress, filter-chip, button, text-field, number-input, temporal/color/file pickers) and migrate: presentational leaves to persistent light-DOM (the soft-7 slice is #1974), single native controls to a persistent wrapper containing a real native control (Shoelace <sl-input> shape). Also harden the retained reserved-case TransientElement with the missing isConnected guard (#1961 rider). Locus: frontierui.

## Scope & slicing

**First act — review current transient (audit before converting).** Enumerate every `class … extends TransientElement` in `frontierui/blocks/**`, and every consumer that wires one (e.g. the `we:src/assets/js/backlog-table-sort.js` chip delegation), to produce the authoritative migration list. The list above is from the #1963 audit and may be stale — grep, don't trust it.

**Two migration families:**
- **Presentational leaves → persistent light-DOM** (`display:contents` where a box breaks flex/grid): badge, tag, card, section-card, auto-heading, meter, progress, filter-chip. Carved as **#1974** (the soft-7 slice; filter-chip added here as a behaviour-free leaf).
- **Single native controls → persistent wrapper with a real inner native control** (Shoelace `<sl-input>` shape): button, text-field, number-input, temporal/color/file pickers. Note text-field/number-input already build a `<div>` around a real `<input>` — the migration keeps the inner control and makes the host persist instead of self-erasing.

**Reserved-mechanism hardening:** `TransientElement` is retained for the reserved content-model-child case; add the missing `if (!this.isConnected) return;` guard before `replaceWith` (the #1961 rider's third leg — idempotent + microtask-deferred already present).

**Consumer cleanup:** once filter-chip is persistent, the #1960 delegate-on-ancestor consumer contract is no longer forced for it (no upgrade to survive); re-scope that rule to the reserved case. Close #2009 as superseded if it hasn't shipped by migration time.

Finite burndown epic (has a Definition of Done: every current TransientElement subclass either migrated or confirmed to be a genuine content-model-child reserved case). Sliced in waves via normal batch ordering.
