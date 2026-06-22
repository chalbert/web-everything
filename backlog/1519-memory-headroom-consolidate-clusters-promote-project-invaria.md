---
kind: story
size: 3
status: open
dateOpened: "2026-06-22"
tags: []
---

# Memory headroom: consolidate clusters + promote project invariants to the platform-decisions doc

Follow-up to #1517 (policy + gate landed; index trimmed 37.7KB→20.6KB, but at 20.6/22KB the headroom is tight). The one-time REDUCTION the policy calls for: (1) consolidate the WE-FUI cluster (boundary, dogfood, zero-impl, generator-is-tool, vision-is-plateau, npm-scope) into one canonical memory; (2) promote project-architecture invariants still living only in memory into we:docs/agent/platform-decisions.md + reduce each memory entry to a pointer (or drop). Cuts index line-count so remaining lines have headroom under the enforced ≤22KB budget. Distinct from the standing merge-before-add/prune cadence the policy already enforces.
