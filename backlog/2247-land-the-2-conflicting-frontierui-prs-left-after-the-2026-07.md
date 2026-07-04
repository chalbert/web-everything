---
kind: task
parent: "2241"
status: open
dateOpened: "2026-07-04"
tags: []
---

# Land the 2 conflicting frontierui PRs left after the 2026-07-03 drain (#2114 Handlebars/Mustache, #2146 content-security)

During the 2026-07-03 manual FUI PR sweep, 9 of 11 ready-to-merge PRs landed; FUI #10 (resolve #2114, Handlebars/Mustache delimiter bundle) and FUI #11 (resolve #2146, content-security dir) then failed with real code conflicts against the freshly-landed delimiter-bundle PRs (#2115 liquid/jinja etc.). FUI has no auto-rebase machinery, so these need a manual rebase onto main + conflict resolution, then merge. Track here so they are not lost.
