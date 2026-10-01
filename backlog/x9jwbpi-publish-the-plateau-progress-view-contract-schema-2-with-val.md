---
kind: story
size: 2
status: open
scope: ["we:contracts/plateau-progress-view.schema.json", "we:contracts/plateau-progress-view.examples.json", "we:contracts/plateau-progress-view.test.ts"]
dateOpened: "2026-09-30"
tags: []
---

# Publish the Plateau progress-view contract (schema 2) with validated examples

Ruling on #4289 (option a, 2026-09-30): the WE half of #4620, landed first. Publish the progress-view contract schema 2 in we:contracts/plateau-progress-view.schema.json with named positive examples in we:contracts/plateau-progress-view.examples.json (partial history, stale cache, missing trend baseline, conflicting plan, cold history, pending review or red CI without a human action) and a declarative validation test we:contracts/plateau-progress-view.test.ts that validates every example and rejects negative counts, an unknown major version and absent source freshness. A consumer can validate a snapshot independently of the UI. Design source: we:docs/agent/plateau-progress-view.md and the prepared split table in we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
