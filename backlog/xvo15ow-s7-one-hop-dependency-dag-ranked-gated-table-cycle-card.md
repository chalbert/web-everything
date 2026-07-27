---
kind: story
size: 5
parent: "2705"
status: open
blockedBy: ["xwmr2vr", "xizryfp"]
scope: ["plateau-app:src/feature-tracker/dag.ts", "plateau-app:src/feature-tracker/dag.css"]
dateOpened: "2026-07-27"
tags: []
---

# S7 · One-hop dependency DAG + ranked gated table + cycle card

Dependencies tab (registers into S2's dep-tab slot): dag-lead sentence, one-hop SVG DAG (upstream/selected/downstream, curved gated edges, honest +N-more, cross-nav), ranked gated-points table, all driven by the one gated set from S1a. Explicit named surface + own baseline for M37 (cycle card).

## Deliverable
The Dependencies tab (registers into S2's dep-tab slot — does NOT edit the detail shell): a dag-lead sentence, a one-hop SVG DAG (upstream/selected/downstream, curved gated edges, honest +N-more truncation, cross-nav), a ranked gated-points table — ALL driven by the one gated set (from S1a) so lead/graph/table can't contradict. NO-DATE named on every gated row. Explicit named surface + own baseline for M37 (dependency cycle): the honest cycle card (a cycle is flagged, never laid out as a DAG), no forecast while the loop stands.

## FT cases → rendered=yes
S5, S6; M34–M37 (+M38 spec).

## Scope
- `plateau-app:src/feature-tracker/dag.ts`
- `plateau-app:src/feature-tracker/dag.css`

## Acceptance
DAG, lead, and ranked table agree on gated features + pts (contradiction test); an isolated node is honest; +N-more is faithful; cross-nav opens the target; M37 renders the cycle card (not a broken graph) with its own baseline; matches baseline in both themes; chart-anchor conformance.
