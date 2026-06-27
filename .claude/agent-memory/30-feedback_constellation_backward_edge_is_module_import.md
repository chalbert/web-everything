---
name: feedback_constellation_backward_edge_is_module_import
description: "Constellation \"backward edge\" = a MODULE import only; a runtime boundary (cross-origin/CLI/subprocess) the same direction isn't forbidden — verify before excluding an option;"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4c9e1aee-8d32-4902-a286-b2a01764c85e
---

The WE→FUI→plateau-app DAG forbids only a **module/code import** in the upstream direction (FUI must not
`import` plateau-app). A **runtime boundary** crossing the same direction — a cross-origin dynamic import,
a CLI/subprocess call, an HTTP request — is **not** that edge: the consumer never resolves the upstream
module, so no forbidden dependency exists. (Same mechanism as [[project_crossorigin_import_keeps_devserver_clean]],
generalized from dev-server hygiene to constellation placement.)

**Why:** in #1595 prep I excluded a "thin FUI shim calling the Plateau run" as *categorically* a forbidden
backward edge. The skeptic refuted that: a cross-origin/CLI shim is a runtime call, not an import — the
honest reason to exclude it was **prematurity** (no operated Plateau run exists in the #1597→#1577 window),
not the edge. Over-stating "forbidden edge" kills a live option for the wrong reason and hands the decider
a false invariant.

**How to apply:**
- Before excluding a placement option as a "forbidden backward dependency," ask: is it a **code import**
  or a **runtime call across a boundary**? Only the import is the banned edge. If it's a runtime boundary,
  exclude it (if at all) on real grounds — readiness, cost, complexity — not the DAG.
- When an executable's **only** consumer is a test (or other downstream artifact), prefer **moving the
  consumer along the existing forward edge** (plateau-app already imports `@frontierui/*`) over keeping a
  duplicate engine copy upstream. A verbatim-copy interim pattern is justified only when a **backward**
  edge forces it (the [[project_conformance_verifier_vs_subject]] cases/goldens copy) — absent that edge,
  one home beats two. Ties to the zero-executable rule [[project_we_zero_standard_implementation]] and the
  consumer test [[project_placement_test_does_fui_consume_runtime]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#relocation-granularity` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
