---
kind: decision
status: open
locus: frontierui
dateOpened: "2026-06-29"
tags: [webcomponents, fui-boundary, transient-element, api-surface, decision]
---

# Transient element exposed API — the stable read/event surface across self-replacement

A transient (A-family) custom element (`TransientElement`,
[fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts)) replaces
itself with a native element on upgrade. The problem: **the surface a consumer reads renames across the swap.**
On `we-filter-chip` the authored `selected` boolean becomes a *computed* `aria-pressed` string and `value`
becomes `data-value` ([fui:blocks/filter-chip/FilterChipElement.ts:52-64](../../frontierui/blocks/filter-chip/FilterChipElement.ts#L52-L64)),
while any host-bound listener is discarded entirely. So `aria-pressed` is `null` pre-upgrade and `selected`
is gone post-upgrade — **neither read is correct in both phases.**

This card decides the **stable API a transient element exposes** so a consumer gets one consistent
read/event surface regardless of upgrade timing. It generalizes beyond filter-chip to every A-family element
(`we-button`/`we-badge`/`we-meter`/`we-text-field`). **Blocks #1960** — the WE consumer-rule wording depends
on what this surface is.

## Grounding — the rename, per phase

| | Pre-upgrade (`<we-filter-chip>`) | Post-upgrade (`<button class="fui-filter-chip">`) |
|---|---|---|
| State | `selected` (boolean present/absent) | `aria-pressed` (`"true"`/`"false"`) |
| `getAttribute('aria-pressed')` | `null` ⚠️ | `"true"`/`"false"` ✅ |
| `hasAttribute('selected')` | ✅ | `false` ⚠️ (excluded, [fui:FilterChipElement.ts:52-53](../../frontierui/blocks/filter-chip/FilterChipElement.ts#L52-L53)) |
| Identity | `value="open"` | `data-value="open"` |
| Host listener (`chip.addEventListener`) | bound | **discarded** ([fui:TransientElement.ts:75](../../frontierui/blocks/transient/TransientElement.ts#L75)) |

The base **moves** children (so child listeners survive) and **copies** non-excluded attributes; it cannot
transfer the host's own listeners (no DOM API exists). Full mechanism table in #1960.

## The axis — what stable surface should a transient element guarantee?

Likely forks (to shape during the decision turn; not yet ratified):

- **Fork A — documentation-only phase-split read contract (zero FUI change).** Codify "read initial state
  from the authored attr (`selected`/`value`) pre-upgrade; read live state off the event target
  (`aria-pressed`) at interaction time; never assume one attr name spans the upgrade." Cheapest; burden stays
  on consumers; the rename remains a latent footgun. (This is what #1960's consumer rule reduces to if nothing
  changes FUI-side.)
- **Fork B — reflect a single survivable attribute (FUI change).** `decorate` also keeps/normalizes a stable
  name on the replacement (e.g. retain `value`; mirror state to a `data-pressed` or keep `aria-pressed` as the
  one canonical key and document that the authored `selected` is *input-only*). The consumer rule collapses to
  one line ("read `aria-pressed`/`data-value`, always"); costs FUI work across A-family elements.
- **Fork C — stable event surface (FUI change, overlaps #1960 Fork 2).** Expose a bubbling change event on the
  replacement so consumers never touch attributes at all. Carries the native-`click` double-fire concern
  flagged in #1960; keep coordinated with that card so the two don't contradict.

The decision: pick the guarantee level (doc-only vs reflected-attr vs event), confirm it holds for *all*
A-family transient elements (not just filter-chip), and state where it's codified (FUI contract doc +
`we:block-standard.md` transient-family note).

## Context

- Split out of **#1960** (WE↔FUI chip-upgrade listener contract) when the "read `aria-pressed`" question
  surfaced that the state attribute *renames* across the upgrade — a transient-API question, not a chip
  consumer-rule question. #1960 is `blockedBy` this card.
- WE holds zero implementation (#1282): any reflected-attr/event change (Fork B/C) is built in FUI; the WE
  side only codifies the resulting consumer rule.
