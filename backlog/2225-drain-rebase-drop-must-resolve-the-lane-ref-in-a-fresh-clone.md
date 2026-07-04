---
kind: story
size: 2
status: open
dateOpened: "2026-07-04"
tags: []
---

# Drain rebase-drop must resolve the lane ref in a fresh clone (origin/lane/…)

The drain's rebase-drop (we:scripts/lib/rebase-drop-manifest.mjs, called from we:scripts/merge-ai-prs.mjs) runs git merge-tree origin/main <headRefName> with the bare lane/… ref. A fresh drain clone (the #2197 precondition) only has origin/lane/…, so merge-tree errors 'not something we can merge' and every BEHIND/CONFLICTING lane PR is left skipped — the drain cannot self-land them (observed 2026-07-03, had to rebuild tips by hand). Fix: fetch or prefix the ref (origin/<headRefName>) before merge-tree.
