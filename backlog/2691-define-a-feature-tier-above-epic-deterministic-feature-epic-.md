---
bornAs: xtucvux
kind: decision
parent: "2505"
status: open
dateOpened: "2026-07-26"
tags: []
---

# Define a "feature" tier above epic — deterministic feature→epic→slice rollup

The feature-tracking screen rolls up slice→epic→feature, but no "feature" tier exists in the backlog today (kinds are only decision/epic/story/task; the largest grouping is epic). Decide how a feature is defined so the rollup is deterministic.

The fork — (a) DERIVE a feature from parent chains (a feature = the set of epics reachable from some root), (b) a new `kind: feature` above epic, or (c) an explicit grouping field on epics. Constraints: native-first / zero-new-required-fields posture; the rule must be deterministic and must handle epics that do NOT share a parent (the red-team found the mock grouped #2527/#2505 under different roots). Open question: what is the canonical derivation rule. This is a PREREQUISITE for the feature-tracking screen's spine.

Spun off the **feature-tracking-screen** design session (design committee → red-team → refine loop) under epic #2676 (Plateau design-studio). Deferred for a later session. Committee decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d
