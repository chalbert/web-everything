---
kind: task
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
tags: []
---

# Remove the empty backlog/2309 file that lands with #297

we:backlog/2309-review-human-label-is-a-sticky-merge-veto-not-only-a-fresh-sc.md is a 0-byte file (the pre-JIT-renumber slug of the #2362 sticky-veto work; the real item is 2362). It rode into PR #297 as an empty ADDED file and will land on main. The backlog renders one card per backlog/*.md, so a blank item file renders as an empty/broken card. Cleanup: git rm the empty file (its NNN assigned at land by the drain). No content to preserve — 2362 carries the actual item. Found in the /review of #297.

**Resolution**: verified stale, no removal needed. PR #297 is still open (not merged); its head branch (we:lane/2362-review-human-sticky-veto) already carries commit 14432ba9 ("fix(backlog): restore #2309 story content emptied by the #2362->#2309 renumber"), which populated we:backlog/2309-review-human-label-is-a-sticky-merge-veto-not-only-a-fresh-sc.md with the full 15-line resolved-story content (kind: story, status: resolved, graduatedTo: we:scripts/lib/review-escalation.mjs) before #297's diff was captured. The PR's file list shows the file as ADDED with 15 additions / 0 deletions — not empty. So no 0-byte file will land on main; the breakage this item was filed against was already fixed upstream in the source lane. No git rm is needed or possible (the file does not exist on origin/main or in this lane's tree today).
