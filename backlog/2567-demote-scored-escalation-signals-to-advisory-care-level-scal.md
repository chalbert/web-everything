---
bornAs: xnuwmzr
kind: story
size: 8
status: open
blockedBy: ["2563"]
dateOpened: "2026-07-18"
tags: []
---

# Demote scored escalation signals to advisory care-level + scale AI-panel rigor by care-level + wire the automated convergence trigger

Core behaviour build of #2563 (codified #blast-radius-advisory-care-not-a-gate). Make blast-radius/size/dismissed/cross-repo/sampling annotate a non-blocking care-level (not a review:pending park); route high-care changes into the convergence loop with raised rigor — a diversity-SELECTION-aggregated AI panel (care-level dials panel size/lenses/rounds), never naive majority vote. Wire a separate scheduled agent-runner to actually run the convergence workflow over care-annotated PRs (the daemon can't spawn agents), converging+labelling only (the resident daemon stays sole main-writer, #2391 lease). Keep gate-self/statute human-gated and non-convergence->review:human.
