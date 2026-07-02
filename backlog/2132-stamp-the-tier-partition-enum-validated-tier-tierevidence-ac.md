---
kind: story
size: 5
status: active
blockedBy: ["2088"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
tags: []
---

# Stamp the tier partition: enum-validated tier + tierEvidence across the 45 projects

Execution of ratified #2088: add the tier enum (core|contextual|exploratory) and the required-tierEvidence rule to we:scripts/check-standards-rules.mjs, then judge every we:src/_data/projects/*.json against the named-consumer evidence bar and stamp tier + a consumer-naming tierEvidence one-liner on each non-exploratory project. The bar and invariants are codified at we:docs/agent/platform-decisions.md#portfolio-project-tiering.
