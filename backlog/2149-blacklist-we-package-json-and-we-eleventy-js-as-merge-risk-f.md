---
kind: story
size: 2
status: open
dateOpened: "2026-07-02"
tags: []
---

# Blacklist we:package.json and we:.eleventy.js as merge-risk files in the parallel partition predicate (rule 2c) so their touchers co-serialize

Cheap floor companion to #2148, from batch-2026-07-01-wf. Of the 7 multiLaneFiles that run flagged, two are genuinely irreducible monoliths: we:package.json (npm mandates one file; adding a script/dep is not splittable) and we:.eleventy.js (central 11ty config; splittable into config fragments but low-churn enough that co-serialize is the cheaper call). #2018 and #2020 both appended to we:.eleventy.js and #2024 and #2087 both appended to we:package.json. Fix: add these two paths to the merge-risk (blacklist) file set in the partition predicate (we:scripts/readiness/lane-partition.mjs plus the inline mirror in we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js, non-negotiable rule 2c) so any two items sharing them are forced same-lane instead of racing an optimistic git merge. Note the third irreducible monolith — the orchestrator script itself, touched by #2073 and #2071 as their subject — is the self-modifying case already covered by #2077, not this item. Distinct from #2148, which SPLITS the FUI barrels (strictly better) rather than blacklisting them.
