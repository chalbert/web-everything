---
type: idea
workItem: story
size: 3
parent: "097"
status: open
dateOpened: "2026-06-08"
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
