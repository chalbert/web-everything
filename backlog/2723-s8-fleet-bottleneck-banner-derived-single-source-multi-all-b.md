---
bornAs: xao3fqx
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2721", "2718"]
scope: ["plateau-app:src/feature-tracker/banner.ts", "plateau-app:src/feature-tracker/banner.css"]
dateOpened: "2026-07-27"
tags: []
---

# S8 · Fleet bottleneck banner (derived, single-source) + multi + all-blocked + cycle

Header banner (registers into S1b's slot) reading bottleneckId/computeBottlenecks from S1a (no render-order dependency). Names the feature(s) gating the most fleet points with a jump. Explicit named surfaces + own baselines for M36 (multiple bottlenecks), S14 (fully blocked), and the cyclewarn state.

## Deliverable
A header banner (registers into S1b's slot) reading `bottleneckId`/`computeBottlenecks` from S1a — NO render-order dependency (R5). Names the feature(s) that gate the most fleet points, with an "open blocker in dependencies" jump; hidden when nothing gates. Explicit named surfaces + own baselines for M36 (multiple independent bottlenecks — `computeBottlenecks`, disjoint chains, "both must move"), S14 (fleet fully blocked), and the cycle banner state (cyclewarn, "no build order, no forecast").

## FT cases → rendered=yes
S7, S14 (S17 spec).

## Scope
- `plateau-app:src/feature-tracker/banner.ts`
- `plateau-app:src/feature-tracker/banner.css`

## Acceptance
Banner, scan BLOCKER flag, and DAG lead cite the SAME feature+pts (single-source test naming which feature each surface must show, R5); hides when nothing gates; the jump selects the blocker + opens Dependencies; M36 surfaces both chains; the cycle state renders cyclewarn; S17 stays spec.
