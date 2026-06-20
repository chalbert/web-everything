---
kind: story
size: 8
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:src/_data/blocks/signature-pad.json"
tags: []
---

# Author the e-signature standard — signature intent + signature-pad block (exercise-app driven)

The exercise-app loop (loan origination #317 S9) drove a new WE standard for e-signature capture, a Layer-2 candidate surfaced by check:app-conformance. Authored the signature intent (we:src/_data/intents/signature.json), the signature-pad block (we:src/_data/blocks/signature-pad.json + we:src/_includes/block-descriptions/signature-pad.njk), and 3 semantics terms. Runtime in fui:blocks/signature-pad/ — SignaturePadElement (keyboard-first typed legal name as the accessible primary path, a drawn canvas as opt-in enhancement, an affirmation gate that must pass before commit) over a DOM-free fui:blocks/signature-pad/record.ts; 14 unit tests. The loan app S9 disclosures consumes it via the sign event. Conformance: 14/14, browser-verified. Scope excludes crypto sealing + legal compliance (app/adapter concerns). Contract freshly minted, revisable.
