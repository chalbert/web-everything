---
kind: task
parent: "2241"
status: resolved
dateOpened: "2026-07-04"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
graduatedTo: none
tags: []
---

# Land the 2 conflicting frontierui PRs left after the 2026-07-03 drain (#2114 Handlebars/Mustache, #2146 content-security)

During the 2026-07-03 manual FUI PR sweep, 9 of 11 ready-to-merge PRs landed; FUI #10 (resolve #2114, Handlebars/Mustache delimiter bundle) and FUI #11 (resolve #2146, content-security dir) then failed with real code conflicts against the freshly-landed delimiter-bundle PRs (#2115 liquid/jinja etc.). FUI has no auto-rebase machinery, so these need a manual rebase onto main + conflict resolution, then merge. Track here so they are not lost.

## Resolution (2026-07-07) — covered; both PRs landed

Both tracked frontierui PRs are now **MERGED**: FUI **#10** (`feat(#2114): Handlebars/Mustache delimiter bundle`) and FUI **#11** (`resolve #2146 — content-security directive pair`). Their conflicts against the freshly-landed delimiter bundles were resolved and the PRs landed via the central `/drain --all-repos` sweep. Confirmed on origin/main: #2114 and #2146 are both `status: resolved`. Nothing left to rebase — resolving as covered.
