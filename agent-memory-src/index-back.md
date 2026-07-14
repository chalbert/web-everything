---
name: index-back
description: Backlog mechanics and item state: backlog is the tracker (md files), NNN immutable, resolve-not-delete, resolve epic by parent edges, parking/soft-defer rules, double-count avoidance, slicing/distributed placement + migration carve, locus verification, map-item-is-not-a-blocker, claim ignores git state, analysis-verdict-is-item-state, materialization into homes, workflow CLIs. Recall when creating, resolving, slicing, parking, or fixing the state of a backlog item.
metadata:
  type: reference
---

Backlog Workflow & Item State cluster — open a leaf with `node scripts/memory-resolve.mjs <N>` (or `--cat`):

- 12. Soft Deferred Parks Retired — soft parks rejected; specifiable-now ⇒ `priority: low`; worse ⇒ `maturityGated`; #1620
- 13. Resolve Go = Open Build Story — a resolved go MUST open its build story; shared mechanism=1 story; #1632
- 14. Accepted-Low = Story, Not Decision — kind:story+priority:low ≠ decision; real dep→blocker card; #1632
- 17. Watch-Log Wrapping A Decision = Conflation — fold into existing watch; resolve the decision not a parallel program; #978
- 23. Distributed Placement → Standalone Slices — carve STANDALONE slices homed by relatedProject; lineage=blockedBy
- 45. Analysis Verdict Is Item State — a triage verdict clears its badge via a frontmatter flag ON the item, not report-only
- 46. Mis-flagged Batchable → Fix Real State — fix REAL relationship (fork→decision, dep→blockedBy, big→size≥13)
- 47. Map Item Is Not A Blocker — a map/planning artifact never resolves-as-decision; repoint dependents; #140
- 48. Must-Co-Land Size Can Be A Double-Count — inflated "must co-land/13" may double-count partner; #1494
- 49. Split Parent Un-converted = Double-Count — story w/ sized children=double-count; finish story→epic; #1460
- 56. Discovery Output Is Cards Only — materializes ONLY as backlog cards, never tooling; unsure→decision card
- 57. Remediate Before Escalate — a below-DoR card gets an agent remediation pass FIRST; escalate residual; #607
- 58. No Decision+Epic Conflation — never one item both type:decision AND epic; split into resolved decision + open epic
- 64. Backlog Workflow CLIs — check-readiness ranks; backlog.mjs claim/resolve/release/scaffold=mechanical splice
- 90. Materialization Pattern Codified — plan → discrete homes (reports + JSON + research topics) → refine in place
- 98. Backlog Locus Often Wrong — locus unset→WE/wrong; verify build home at claim, fix it
- 105. Claim Ignores Git State — backlog ownership=status:active NOT the working tree; uncommitted edits never a drop-reason
- 106. Backlog Is The Tracker — /backlog/ renders from backlog/*.md (one file per item); docs/agent/backlog-workflow.md
- 107. Backlog NNN Is Immutable — never rename/renumber an item's NNN; a new item yields to the next free number
- 108. Close-out: Resolve, Don't Delete — done→status:resolved (keep file); gate warns if resolved lacks graduatedTo
- 109. Resolve Epic By Parent Edges — list children by `parent:` (grep), not body's "N children"; #658
- 137. Migration Carve: Recoverable vs Lossy — additive cap + blockedBy child=sequencing; flatten=loss; #1866
- 145. Search Backlog Before Filing — grep backlog/ before `scaffold`; the watch pre-files gap cards, so it may already exist (dup'd #2485/#2484); #2489/#2495
