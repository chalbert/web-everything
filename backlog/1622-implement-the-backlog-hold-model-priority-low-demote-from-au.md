---
kind: story
size: 5
status: active
blockedBy: ["1620"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
tags: []
---

# Implement the backlog hold model: priority:low demote-from-auto-select + maturityGated park reason (#1620)

Implement the two hold mechanisms ratified in #1620. Fork 1: an optional priority:low bit that the readiness --select ranker EXCLUDES from the auto-selected ready set while the loader still LISTS it in a visible 'deprioritised/filler' group (demote-not-hide). Fork 2: a maturityGated parkedReason requiring a typed, externally-verifiable maturityTrigger (externalConsumers>=N | realRuns>=N | a named adoptionSignal) — the gate errors on a maturityGated item with no typed trigger. Touches we:src/_data/backlogMeta.js (priorityMeta + parkedReasonMeta), we:scripts/check-readiness.mjs + we:scripts/readiness/, we:scripts/check-standards-rules.mjs, and we:src/_includes/backlog-badges.njk.

## Build

**Fork 1 — `priority: low` (demote from auto-select, keep visible):**
- Add a `priorityMeta` vocab block to [we:src/_data/backlogMeta.js](../src/_data/backlogMeta.js) — one honored value `low` (absent = normal), with a muted pill (label/bg/fg/tip).
- In [we:scripts/readiness/](../scripts/readiness/) (the proposer/projection) **exclude `priority: low` from the auto-selected ready set** so it stops surfacing as Tier-A — but keep it in the loaded set tagged for a separate "deprioritised / filler" group.
- In [we:scripts/check-readiness.mjs](../scripts/check-readiness.mjs) `--select` output, render the filler group as its own visible section (browsable, hand-pickable), distinct from the ready set.
- Render the `low` pill on the tile / Prioritisation table / detail page via [we:src/_includes/backlog-badges.njk](../src/_includes/backlog-badges.njk).

**Fork 2 — `maturityGated` park reason:**
- Add `maturityGated` to `parkedReasonMeta` in [we:src/_data/backlogMeta.js](../src/_data/backlogMeta.js) with its pill + tooltip.
- Define the typed `maturityTrigger` shape — one of `externalConsumers>=N` · `realRuns>=N` (a named manual skill + stability assertion) · a named `adoptionSignal` (a concrete integration milestone). **Never a date or bare "later."**
- In [we:scripts/check-standards-rules.mjs](../scripts/check-standards-rules.mjs) the gate **errors** on a `maturityGated` item with no typed `maturityTrigger` (mirrors the body-less park error today), and validates the trigger names a counter or an external artifact's existence.

## Acceptance

- A `priority: low` item is absent from `check:readiness --select`'s auto/ready set but appears in a clearly-labelled filler section; its `low` pill renders on all three surfaces.
- A `maturityGated` item with a valid typed `maturityTrigger` passes the gate and shows its pill; one with a missing/untyped/date-only trigger **errors** in `check:standards`.
- `npm run check:standards` is green after the change.
