---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["588"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "block:inline-trigger + intent:inline-trigger (blocks.json + intents.json + block-descriptions/inline-trigger.njk)"
relatedReport: reports/2026-06-14-inline-trigger-mention-pattern.md
tags: [candidate-standard, intent, block, mention, build]
---

# Build the inline-trigger detection block + intent

Build the ratified inline-trigger standard (#591): a runnable trigger-detection block (boundary-anchored char match -> query slice -> caret anchor -> route to results) plus an intent for the declarative dimensions (trigger-set registry, boundary/query policy, most-permissive defaults). Detection-only per #591 Fork 2-A: emit the resolved selection {key, query, range, item}; the consumer commits. Composes the general picker surface (#588) for results and the anchor intent for caret tethering. Ships reference insertion adapters for text (default) and token (composes #590), owning neither commit. Forced invariants: APG editable-combobox virtual focus, IME-composition suspension, not-a-protocol. blockedBy #588 (results surface).

## Progress

- **Block** `inline-trigger` added to [src/_data/blocks.json](/src/_data/blocks.json) (status `draft`, `implementsIntent: inline-trigger`, composes input/anchor/focus-delegation/live-region-status/selection) with 5 design decisions capturing the Fork 1-C / Fork 2-A rulings (detection-only, caret virtual anchor, APG editable-combobox virtual focus + IME suspend, reference text/token adapters owning neither commit).
- **Block description** [src/_includes/block-descriptions/inline-trigger.njk](/src/_includes/block-descriptions/inline-trigger.njk) — anatomy (detect → slice → anchor → route), detection-only scope, a11y invariants, not-a-protocol, cross-refs.
- **Intent** `inline-trigger` added to [src/_data/intents.json](/src/_data/intents.json) (status `draft`, 4 dimensions: `triggerSet` open registry, `boundaryPolicy`, `queryPolicy`, `insertionMode` text|token — all most-permissive defaults) + full HTML description with the forced invariants below the dimensions.
- Detection-only emits `{key, query, range, item}`; token adapter composes #590 without blocking on it. Reference adapters (text/token) specified in the contract; the runnable engine is a #frontierui impl concern (no WE `sourcePath`, per the constellation split). Gate green; /blocks/inline-trigger/ + /intents/inline-trigger/ render.
