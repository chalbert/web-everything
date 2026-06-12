# Capability extraction — normalized matrix from the benchmark corpus

**Date:** 2026-06-12
**Backlog:** #346 (phase 2 of epic #315)
**Research topic:** [/research/benchmark-capabilities/](/research/benchmark-capabilities/)
**Data:** `src/_data/benchmarkCapabilities.json` · **Corpus:** `src/_data/benchmarkCorpus.json` (#316)

## What this is

Phase 2: every benchmark-corpus source's components, documented patterns, design tokens, and
accessibility/i18n standards, ingested bottom-up into **one normalized capability matrix** — the internal
pivot phase 3 (#347) joins against. Capability-keyed with cross-source dedup, so one `menu` row carries the
union of sources that ship it rather than 20 vendor-specific entries.

## Schema (one row per capability)

`id` · `label` · `kind` (component / pattern / token / standard) · `family` · `ubiquity` (universal /
common / partial / rare-emerging) · `notableIn` (standout implementations) · `nativeAnchorHint` (the native
API/element/standard it plausibly maps to) · `summary`.

`nativeAnchorHint` is the load-bearing field for the program's **native-first** discipline: it is recorded
now so phase 3 can decide whether a capability is a real platform gap or something the web platform already
provides (`dialog`, `popover`, `selectlist`, anchor positioning, Constraint Validation API, `Intl.*`).

## First-pass coverage

~95 capabilities across the four kinds: a broad component catalogue (actions, forms, disclosure, menus,
selection, navigation, overlays, data-display, feedback, layout), the cross-cutting patterns design systems
compose (anchored positioning, focus trap/return, roving tabindex, type-ahead, dismissal, async pagination,
virtualization, drag-and-drop, controlled/uncontrolled, live regions, validation flow), the token families
(color/type/spacing/elevation/radius/motion/dark-mode/density), and the standards expectations (ARIA APG
adherence, keyboard spec, focus-visible, reduced-motion, contrast, touch target, i18n/RTL).

## Method & reproducibility

Sources read into shared ids; synonyms merged (snackbar=toast, sheet=drawer, autocomplete=combobox). Keyed
by stable `id` so a re-run produces a clean diff (added / removed / re-classified), not a rewrite. Bump
`version` + `lastSwept` per run (feeds #349 repeatability).

## Scope decision (deferred to fan-out)

This is a **first pass**. `ubiquity` is a coarse cross-corpus signal and `notableIn` flags canonical
implementations; **exact per-source presence and deep per-(capability×source) doc URLs are deferred** to a
per-source fan-out — captured as a follow-up under #315 rather than blocking the pipeline. This keeps #346's
deliverable to the durable parts (schema + method + deduped capability set) and lets phase 3 proceed to map
and find gaps now. The story flagged this split possibility explicitly.

## Next

#347 (mapping & gap detection) joins each capability to a WE entity (block/intent/plug/protocol/project/
semantics) and labels covered / partial / missing / native-covered, carrying the gap-# triage fields.
