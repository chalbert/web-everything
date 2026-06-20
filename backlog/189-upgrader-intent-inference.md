---
kind: story
size: 3
parent: "097"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: none   # enhanced the existing upgrader analyzer; no new entity spawned
tags: [upgrader, intents, analyzer, conformance, neutral-structure]
relatedProject: webintents
crossRef: { url: /backlog/094-ai-upgrader-tools/, label: "AI upgrader MVP (#094)" }
---

# Upgrader intent inference — populate the IR's intents from observed patterns

The [#094](/backlog/094-ai-upgrader-tools/) engine's neutral structure (`ComponentIR`) already
carries an `intents` field, and the **verify gate already conformance-checks it** (an intent that
doesn't resolve in the standard fails verification). But the reference analyzer ships it **empty** —
it never infers intents. This item closes that loop: detect WE intents from observed legacy patterns
and populate `ir.intents`, so upgraded output declares the UX intents it actually expresses.

Examples of inferable signals: a toggled `aria-expanded` / `hidden` pair → `disclosure`; a
`role="listbox"` + `aria-selected` → `selection`; a `prefers-reduced-motion` guard → a `motion`
intent. Each inference must be **conservative and surfaced as an analyzer note** (flag, don't fake —
same discipline as the rest of the pipeline); a wrong guess that references a real intent would pass
verify but mislabel the component, so prefer omission over a shaky inference.

Pairs naturally with the BYO-AI provider ([#188](/backlog/188-upgrader-byo-ai-model-analyzer/)),
which can infer intents far better than heuristics — but a few high-confidence deterministic rules
are worth shipping first so the field is exercised end-to-end without a key.

## Progress
- **Status:** resolved — deterministic intent inference shipped + demonstrated end-to-end.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `inferIntents(template, code)` in `we:legacyWebComponent.ts` — two conservative rules:
    `role="listbox"` + `aria-selected` → `selection`; `prefers-reduced-motion` guard → `motion`. Both
    require unambiguous signals, each adds an analyzer note, and `analyze()` now populates `ir.intents`.
  - Shared fixtures (`we:upgrader-cases.ts`): added `expectIntents` + two cases (`listbox-selection-intent`,
    `reduced-motion-intent`); the suite loop now asserts `expectIntents`.
  - `we:upgrader.test.ts`: +6 cases incl. the conservative-omission guard (listbox without aria-selected
    infers nothing) and an inferred-intent passing the verify gate. Suite 23/23 green.
  - Demo (`we:code-upgrader-demo.ts`): reference cards now pass `knownIntents` so the inferred intent
    shows a green `✓ intents — N resolve` check. Playground verified live on :3000 — 13/13, both new
    cards `✓ upgraded`, IR panes show the inferred intents, no page errors.
  - `check:standards` 0 errors.
- **Leftover captured:** `aria-expanded`/`hidden` → `disclosure` deferred to **#246** (blocked on the
  disclosure intent, gap #008) — inferring a non-existent intent would fail the verify gate.
