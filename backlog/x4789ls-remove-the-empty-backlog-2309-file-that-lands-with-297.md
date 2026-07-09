---
kind: task
status: open
dateOpened: "2026-07-09"
tags: []
---

# Remove the empty backlog/2309 file that lands with #297

we:backlog/2309-review-human-label-is-a-sticky-merge-veto-not-only-a-fresh-sc.md is a 0-byte file (the pre-JIT-renumber slug of the #2362 sticky-veto work; the real item is 2362). It rode into PR #297 as an empty ADDED file and will land on main. The backlog renders one card per backlog/*.md, so a blank item file renders as an empty/broken card. Cleanup: git rm the empty file (its NNN assigned at land by the drain). No content to preserve — 2362 carries the actual item. Found in the /review of #297.
