---
kind: decision
parent: "1294"
status: open
priority: low
relatedProject: webvalidation
relatedReport: reports/2026-06-27-split-analysis-1294-webcompliance.md
dateOpened: "2026-06-27"
tags: [conformance, constellation-placement, relocation]
---

# Conformance model for non-facts-verdict relocated runtimes

The #1294 relocation cascade proves conformance via the #899/#1789 facts→verdict vector model (observe a verdict). That model does not fit the non-engine relocated runtimes — formatting (intl), aggregation (analytics), token-projection (webtheme, #404), and provider-strategy planes (reliability) — whose output is not a verdict. Before those subsystems can relocate with a valid conformance proof, decide their conformance model. Resolved #1784 covers only the facts→verdict KIT; this is its non-engine complement.

## What you decide

How a relocated **non-facts→verdict** runtime proves conformance through the plateau-hosted runner, given the #899 vector model observes a *verdict*. Candidate shapes (to research at `/prepare` time, not pre-settled here):

- **A different observable shape** — extend the vector model so `observeVia`/`expect` can assert a formatted string, an aggregated number, or a projected token map (not just a verdict). One model, wider observation vocabulary.
- **A golden-output snapshot model** — a separate `(input → golden output)` corpus shape (like the Doc Spec suite #1163, which already sits beside the interaction-script `ConformanceVectorSuite`), per non-engine subsystem.
- **A per-shape binding variant** — distinct binding bases per output kind (formatter / aggregator / token-projector), each with its own judge.

## Lineage

Surfaced by `/slice 1294` (`we:reports/2026-06-27-split-analysis-1294-webcompliance.md`) as the gate for the non-engine subsystems — flagged in the prior 1294b analysis but never filed as a card. Grounds: #1784 (facts→verdict KIT, resolved — this is its complement), #899 (declarative-vector model), #1789/#1790 (synchronous binding + runner), #1163 (the Doc Spec golden-vector precedent), #404 (webtheme token projection), #1282 (zero-executable rule driving the relocation).
