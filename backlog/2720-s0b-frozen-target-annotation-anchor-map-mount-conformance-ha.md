---
bornAs: xojug01
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2717"]
scope: ["plateau-app:src/feature-tracker/feature-tracking.mount-conformance.test.ts", "plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html"]
dateOpened: "2026-07-27"
tags: []
---

# S0b · Frozen-target annotation + anchor map + mount-conformance harness

Annotate the ft-integrated-v3 target with data-uc anchors on every rendered=yes surface, commit it as the frozen target, and scaffold the functional-DOM mount-conformance test (built anchor-set + per-anchor tokens vs the frozen target + the pinned date-format matcher).

## Deliverable
Annotate the frozen ft-integrated-v3 target with `data-uc` anchors on every `rendered=yes` surface + each `__setState` variant; commit it as the FROZEN target. Scaffold the functional-DOM mount-conformance test: built-DOM anchor-SET + per-anchor tokens vs the frozen target + the pinned date-format matcher.

## FT cases → rendered=yes
Conformance infra for all yes cases (no new render).

## Scope
- `plateau-app:src/feature-tracker/feature-tracking.mount-conformance.test.ts`
- `plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html`

## Acceptance
The frozen target has an anchor on each yes surface; a relabelled/wrong surface FAILS (the expected map is authored in the design, not the build); the date-matcher matches ISO / `Mon DD` / `in N wks` / `QN` / month names.
