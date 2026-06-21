---
kind: story
size: 5
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: []
---

# Author the experiment (variant-assignment) intent + its evaluation-provider contract

Ratified by #1414 (Forks 1+2). Author a new experiment / variant-assignment intent under Web Intents: declarative 'this subtree renders the arm assigned to the current unit', open variant dimension (the arm set), most-permissive default = control/default arm (OpenFeature DEFAULT). Compose a DISTINCT evaluation-provider contract reusing the Guard seam pattern (native-first → project override → custom plug, we:src/_data/projects/webguards.json) returning {value, variant, reason} (OpenFeature vocab) with NO security semantics — a variant arm is not an authz verdict. Borrow the OpenFeature reason enum verbatim; bucketing stays impl behind the provider. May itself split intent-vs-provider-contract slices.
