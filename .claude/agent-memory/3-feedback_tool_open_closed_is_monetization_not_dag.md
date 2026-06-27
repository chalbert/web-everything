---
name: feedback_tool_open_closed_is_monetization_not_dag
description: "A devtool's open/closed home is a product/monetization call, not a DAG/placement one; generic≠open; run-against-your-own-build tools → closed Plateau, WE keeps only the result contract"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 18fd617f-1ee7-456c-9c59-e50706b4eb6c
---

When deciding where a devtool lives in the constellation, the FIRST question is **open giveaway vs
paid product**, not which repo the DAG allows. Open-core draws one line: the **standard (WE)** and the
**reference implementation (FUI)** are the open giveaway that drives adoption; **products are
closed/paid** (Plateau).

**Generic ≠ open.** A tool being a standalone, app-agnostic, point-it-at-a-URL analyzer does NOT make
it open — half the commercial tooling market is exactly that. Generic-ness, if anything, cuts *toward*
closed: a tool that works on ANY app has a market beyond the ecosystem = product value, not adoption
bait.

**The positive test:** an operator-facing surface you *run against your own build* (explorer, assembler,
configurator, dev-browser) → **closed Plateau**, with free/paid on the assembler model (cost/hosting
line). What WE keeps is **only the result/output-format contract** (an interchange schema, e.g.
SARIF-compatible) so other tools can consume output — never the engine. See [[project_conformance_verifier_vs_subject]]
(WE keeps the CONTRACT) and [[feedback_impl_is_not_a_standard]].

**Why:** I twice mis-concluded "the explorer engine is open / belongs to FUI" — first because it lives
in FUI, then because it's generic. Both are non-sequiturs. The user's correction: FUI doesn't *consume*
the explorer (zero code imports — it's just a browser *subject* the tool points at), so nothing forces
it open or into FUI; it's a product → closed Plateau.

**How to apply:** for any tool-placement decision, ask "is this the open standard/reference-impl, or a
product run against a build?" before touching DAG/repo mechanics. Don't let "it's a generic library" or
"it lives in the open repo today" stand in for "it's open." Ruling codified in
`docs/agent/platform-decisions.md#devtools-placement`; #1747.
