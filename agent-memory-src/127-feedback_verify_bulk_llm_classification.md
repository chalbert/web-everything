---
name: feedback_verify_bulk_llm_classification
description: a low-effort bulk LLM classification/labelling pass is unreliable — always run an adversarial verification pass before trusting or committing its output
metadata: 
  node_type: memory
  type: feedback
  originSessionId: af09a6c1-7fc2-4e8d-b1a2-2c302283d75a
---

A one-shot low-effort agent classification over many items (e.g. mapping 106 decisions → statute
anchors in the #911 codification sweep) is **NOT trustworthy** — measured ~50–75% wrong on the
"matched an existing bucket" cases, and the errors carried **high confidence** (an agent fabricated a
clause to justify a wrong anchor). Confidence is not a safety net for this shape of task.

**Why:** "is this an instance of rule X?" is lenient-by-default — the agent sees the *spirit* and
over-matches on shared words (a decision about "WE = contracts only" got mapped to
`compose-dont-handroll` because both mention "compose"). A narrow build/scoping call gets over-promoted
to "establishes reusable rule X."

**How to apply:** for any bulk classification/labelling whose output you'll commit, run a second
**adversarial verification** pass (one skeptic per item, prompted to REFUTE, told "the prior pass
fabricated a clause at least once", asked "does the anchor's WRITTEN statement literally cover this?").
Reconcile against the **actual on-disk state**, not the intermediate result files (those drift). Apply
only the conservative verdict (confirm / remap-to-existing / downgrade-to-one-off); hold proposed
NEW canon for human ratification. Builds on [[feedback_wait_for_explicit_ratification]],
[[feedback_remediate_before_escalate]], [[project_platform_decisions_statute_layer]].
