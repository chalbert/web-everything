---
bornAs: x5ac64s
kind: task
status: open
relatedTo: ["2396"]
tags: [lane, finish, proof-of-land, bug]
dateOpened: "2026-07-12"
---

# Unify the resolved-on-main readers in we:scripts/lane-resume.mjs (loose resolvedItemSet vs frontmatter-strict resolvedOnMain)

`we:scripts/lane-resume.mjs` now holds two independent readers of the one predicate "is item N `status: resolved` on origin/main": the pre-existing `resolvedItemSet()` (a loose regex over the first 400 chars, feeding `discover`'s blockedBy gating) and #2396's `resolvedOnMain()` (frontmatter-parsed via `readField`, feeding the rebuild-plan proof-of-land). Route both through one frontmatter-strict reader so the discover path can't be spoofed by early-body content while the rebuild path refuses, and so a future proof-format change lands once instead of drifting.

## Why now

Surfaced by the PR #427 review panel (advisory, non-blocking there because `resolvedItemSet` predates the PR): an open item whose body carries a column-0 `status: resolved` within its first 400 bytes is read as a landed blocker by `discover` while the same pass's rebuild half correctly refuses it — one `/finish` pass holding two answers to the same question. Fix shape known: extract the #2396 frontmatter-strict check and have `resolvedItemSet()` use it; keep the single-batched `git show` read pattern for discover's fan-out. Regression test: the fenced-example spoof file must read NOT resolved through *both* entry points.
