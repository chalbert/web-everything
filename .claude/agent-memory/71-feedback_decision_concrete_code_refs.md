---
name: feedback_decision_concrete_code_refs
description: "Before presenting a decision item, ground its fork in concrete file:line code refs into the real tree — read the actual code, don't rely on authored snippets"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 673cbd9d-ed01-4124-993b-fec4b7c577de
---

When working a `decision`/`review` backlog item, the fork-readiness pass must surface **concrete code to look at** — real `file:line` references into the actual codebase that the decider can open — whenever the fork concerns code that already exists. An authored illustrative snippet is allowed *in addition* but never *instead*; it hides whether the fork matches what's actually shipped.

**Why:** the user asked for this more than once and it kept getting skipped. A decision is only as good as the real code the decider can inspect. In #020, reading the actual tree revealed base-select was *already* a registered first-class resolver impl (`capabilityMatrix.json`), which collapsed a "promote it?" fork into a narrow "surface it in the public catalog + honest status" call — invisible from prose alone.

**How to apply:** at claim time, go read the relevant code and cite `file:line` in the item body (not just chat); author a minimal before/after only to sharpen the choice. Purely greenfield forks (no code yet) may use a candidate sample. Codified in `docs/agent/backlog-workflow.md` → *Fork-readiness pass* → first bullet. Related: [[feedback_decision_mode_engage_real_fork]], [[feedback_authoring_standard_workflow]], [[feedback_plain_language_review_checklists]].
