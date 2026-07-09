---
kind: task
status: resolved
dateOpened: "2026-07-09"
dateResolved: "2026-07-09"
tags: []
---

# Remove the empty backlog/2309 file that lands with #297 — RESOLVED (content restored, not removed)

Original premise was wrong: the /review of #297 read `we:backlog/2309-review-human-label-is-a-sticky-merge-veto-not-only-a-fresh-sc.md` as a stray 0-byte dup and prescribed `git rm`, on the belief "the real item is 2362, no content to preserve." Investigation on the #297 branch found the opposite — `2309` **is** the sticky-veto story, renumbered `#2362→#2309` by a drain merge that emptied the file instead of moving its content; the branch's `2362-*` file is a **different** item (pr-land-escalation-miscomputes). So the correct fix was to **restore** the resolved-story record into `2309` (its pre-renumber content, git blob a9370a3b), NOT delete it — deletion would have destroyed the legitimate resolved-story record of the #297 work. Restored on the #297 branch (commit 14432ba9); CI `test` is green. The empty/broken-card concern this task tracked is resolved by that restore. Do NOT `git rm` 2309. The underlying drain-renumber-empties-a-file defect stays tracked by the #2312/#2316/#2348 renumber cluster.
