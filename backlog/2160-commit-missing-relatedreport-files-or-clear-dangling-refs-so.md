---
kind: task
status: open
dateOpened: "2026-07-02"
tags: [ci, backlog-hygiene, pr-flow]
relatedTo: ["2138", "2153"]
---

# Commit missing relatedReport files (or clear dangling refs) so origin CI test job goes green

The CI `test` job is **red on origin/main** (run 28611512730, SHA 4059ce4c): the vitest backlog suite asserts every `relatedReport` file exists, and several items point at reports present only as **untracked working-tree files** never committed to origin — e.g. `we:reports/2026-06-19-autonomous-exploratory-ui-testing.md` (#1552), `we:reports/2026-06-22-interim-fui-explorer-layer2-wiring.md` (#1595), `we:reports/2026-06-21-spatial-manipulation-arrangeable-surfaces.md` (#1384), `we:reports/2026-06-21-140-split-analysis.md` (#1392). `git ls-files -o reports/` shows ~20 uncommitted reports. Local `check:standards` is green because the files are on disk; CI (fresh origin checkout) fails. **For each dangling `relatedReport`: commit the report if legit, else null the ref.** This blocks the whole #2138 self-approved-PR flow — the required `test` check can never pass on a PR while origin CI is red, so #2153's `gh pr merge` path is un-landable (admin direct-push still works via the `enforce_admins:false` bypass from #2152).
