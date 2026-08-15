---
kind: decision
status: open
dateOpened: "2026-08-15"
relatedTo: ["2576", "2649", "2575"]
tags: []
---

# Reconcile #2576 per-option 1-5 ratings text against jury-core verdict model

#2576 (resolved, ratified jury-refinement method) specifies per-option RATINGS 1-5 as a named guardrail. The shipped jury-core engine (epic #2649, `we:scripts/lib/jury-core.mjs` `VERDICTS`) instead grades each juror accept/changes/needs-human/prevention-outstanding — a 3-4 value categorical verdict, never a 1-5 numeric scale. No ratified amendment reconciles the two. Decide: (a) treat verdict as the intentional, superseding shape (amend #2576s text to match what shipped), or (b) jury-core is missing a numeric per-option rating dimension the ratified method actually calls for and should add one. Surfaced while preparing #2575 (decision-record schema), whose `jurorRatings` field needs to know which shape is authoritative.
