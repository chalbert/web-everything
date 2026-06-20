---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: block:slider
tags: [block, slider, range, input, selection, native-first, candidate, harvest]
relatedProject: webblocks
---

# Slider / range block — enhance native `<input type="range">`

A **Slider block** for selecting a numeric value (or a min–max **range**) along a track. The Selection Intent already declares a `range` variant (`SelectionVariant = 'boolean' | 'item' | 'range'`), but no block realizes it — this fills that gap.

Native-first by construction: a single-thumb slider *is* `<input type="range">`. The block's job is the enhancements the native control can't express alone:

- **Dual-thumb range** (min/max) — not natively a single element; the standard composition for "from–to".
- **Ticks, steps, and labelled marks**; value formatting that composes the Locale/Translation intents (units, number formatting).
- **Accessible value reporting** — `aria-valuetext` for formatted/units output, keyboard step/page increments, RTL track direction.

## Scope to design (via [we:design-first.md](../docs/agent/design-first.md))

- Where native `<input type="range">` suffices vs. where a custom track/thumb is required (dual-thumb, vertical, rich ticks); keep native the baseline and enhance only when ruled out.
- Composition: **Selection Intent** (`variant: 'range'`, `constraints.min/max`), **Input Intent** (modality — pointer drag vs. keyboard vs. touch), **Locale Intent** (value formatting).
- Relationship to a future numeric/stepper input — slider is the *continuous-along-a-track* member.

> **Provenance:** surfaced during a final review of the legacy `plateau` repo, where `we:slider.md` was an empty stub. **Plateau is not a model and must not be consulted or copied** — build this fresh from the Selection Intent's existing `range` variant.

## Progress

- **Status:** resolved → `block:slider`.
- **Done (authored fresh, design-first):**
  - `fui:blocks.json` — new `slider` Component (status draft): `implementsIntent: selection`, `composesIntents: [selection, input, locale, translation]`, and 4 design decisions (single-thumb IS native `<input type=range>` / dual-thumb = two bound ordered values / `aria-valuetext` formatted via Locale / slider vs stepper boundary).
  - `we:block-descriptions/slider.njk` — overview, native-first feature-inventory table (disposition + tier marking where native suffices vs custom track/thumb), an Altitude-1 native single-thumb example and a dual-thumb-range example, and an explicit boundaries section.
  - `we:semantics.json` — two new terms: **Slider** and **Dual-Thumb Range** (per AGENTS rule 3).
  - Page route + webblocks catalog auto-wire from `fui:blocks.json`. `gen:inventory` regenerated (36 blocks); `check:standards` green (0 errors).
- **Realizes** the Selection Intent's pre-existing `range` variant — no new dimension invented; `constraints.min/max` become the two thumb bounds.
- **Leftovers:** the future numeric/stepper input (named as the discrete-entry sibling) is out of scope; Frontier UI reference implementation is the standard-vs-impl follow-on.
