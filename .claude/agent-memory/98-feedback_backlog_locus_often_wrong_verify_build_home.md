---
name: feedback_backlog_locus_often_wrong_verify_build_home
description: "backlog `locus` is often unset→WE or wrong for impl/reconcile items; verify the real build home at claim, fix in place"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 36ffadda-8d91-4922-a267-3f0400ff91d4
---

A backlog item's `locus` is frequently **unset (→ defaults to `webeverything`) or wrong** for
implementation and "reconcile" items — in batch-2026-06-26, **4 of 7** items defaulted/were set to
`webeverything` but actually built in FUI or plateau (e.g. #1806 motion-vocab reconcile → plateau runtime;
#1628/#1630 compiler opt-ins + #1658 trait-enforcer pre-step → `frontierui/`).

**Why:** the [[project_we_zero_standard_implementation]] rule means impl lives in FUI (and product code in
plateau), but the item author often leaves `locus` blank or guesses WE — so the loader-derived locus, the
gate it would run, and the `commitTarget` are all wrong until corrected.

**How to apply:** at **claim** time, verify the real build home before trusting `locus` — grep a sibling's
`graduatedTo:` (e.g. `tools/trait-enforcer/webpack-plugin.ts` → FUI) or apply the zero-impl rule
([[project_placement_test_does_fui_consume_runtime]]), then **fix the `locus` in place** (a correctness fix,
not a design call) so the gate runs in the right repo and the commit lands in the right tree
([[reference_repo_constellation]]). A wrong locus silently runs the wrong gate and commits to the wrong repo.
Related: [[feedback_reusable_to_neutral_home]], [[feedback_misflagged_batchable_fix_real_state]].
