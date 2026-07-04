---
name: feedback_resolved_blocker_can_be_false_edge
description: "a resolved blockedBy can be a FALSE edge; verify the unblocker delivers the needed capability, not just that it closed;"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f3a608a2-5014-4ec4-9eaa-0543e2c12022
---

A `blockedBy` edge pointing at a **resolved** item is NOT proof the precondition is met. The selector
clears the edge the instant the target flips `resolved`, but "resolved" only means *that* item shipped —
not that it shipped the **specific capability** the dependent actually needs.

**Why:** #1355/#1531 (data-table/pagination backend deletes) were `blockedBy: 1597` on the premise that
#1597 = "the Plateau conformance home this card waits on." #1597 resolved, so the projection surfaced both
as batchable. But grounding showed #1597 landed the **behavioral-vector** runner
(`runConformanceVector`/`judgeConformanceTrace` over a `ConformanceBinding`) — a *different mechanism* than
the renderer **golden-audit** (`auditDataTable(root, golden)`) the deletes need. The real home was verified
absent in `plateau:src/` and never filed. The edge was named right ("conformance home") but pointed at the
wrong mechanism.

**How to apply:** at pre-flight/claim, don't trust a cleared `blockedBy` — open the resolved unblocker and
confirm it delivers the exact artifact/capability the dependent consumes (grep the target tree for the
named function/module, not just the issue's status). If it doesn't, the edge is false: file the real
prerequisite as its own item, re-point `blockedBy` at it, and treat the dependent as blocked-in-fact. A
word like "home"/"runner"/"engine" can resolve under two different mechanisms — verify which one.
Generalizes [[feedback_prep_verify_mechanism_has_consumer]] and
[[feedback_crosslocus_preflight_verify_consuming_tree]] to the blocker DAG itself.

**Same trap when SEEDING new work from a body note (#606, 2026-06-24).** A parenthetical claim in an
item's body — especially "(#NNN dropped stale — reopen)" or "needs X first" — is a *hypothesis about the
tree's current state*, not a fact. I filed sub-epic #1768 straight from #1353's note "relocate the bootstrap
plug (#606 dropped stale — reopen)" — but #606 was **resolved** (plugs already live in FUI; #1234/#1046
landed the repoint), so the whole "relocate" premise was already delivered and most of the "7 families to
delete" were either WE-legit standard derivation (`blocks/router` = #1684) or already gone. Before
scaffolding a child/sub-epic from a body note, resolve every cited `#NNN` to its **real status** and the
tree it claims about — a stale note propagates a false premise into a brand-new item.
