---
bornAs: xq4nv2t
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# The drain's rebase auto-resolve can silently EMPTY a conflicted file instead of merging it

The drain rebases a stale `lane/*` branch onto `origin/main` and auto-resolves "non-overlapping content conflicts" (#2371). On 2026-08-05 that pass turned we:backlog/2909-blast-radius-misses-skills-src-editing-a-skill-s-source-scor.md into a **zero-byte file**: two sessions had edited different regions of the same item, and the resolver dropped *both* sides rather than keeping either. The commit message reported success. Only a downstream test caught it, and only because an empty backlog item happens to fail validation — a file with no validator would have landed empty.

## What happened

Lane `lane/2909-blast-radius-source-trees` (PR #1048) branched from `5316d2d6` and edited #2909's frontmatter
(`status: open → resolved`) plus appended a section. Concurrently, another session's PR #1047 landed
`0e2a2636`, which rewrote the same item's title, digest, and added a `### The agent-memory corpus is missing on
BOTH sides` section.

The drain then produced commit `836ae978`:

```
drain: rebase lane/2909-blast-radius-source-trees onto origin/main,
auto-resolve non-overlapping content conflict(s) in backlog/2909-…md
```

Result: `wc -c` on the file → **0**. Both the 72-line main version and the lane's edits were gone. The two
edit regions genuinely were non-overlapping, which is exactly the case the resolver claims to handle.

## Why it is worse than one lost file

- **It reports success.** The commit message says "auto-resolve", not "could not merge". Nothing in the drain's
  output signals that content was destroyed, so the failure is invisible at the point it happens.
- **The only thing that caught it was incidental.** `validateBacklogItem — real backlog stays clean` errored on
  the empty item (CI `test-shard (4)`). That check exists to validate backlog schema, not to detect resolver
  data loss. A conflicted `we:docs/`, `we:reports/`, or source file emptied the same way has no such tripwire.
- **The window is the common one.** Two lanes touching one file in different places is the routine case in a
  38-lane pool, and it is precisely what the #2371 auto-resolve was built to smooth over.

Verified no zero-byte file has actually reached `main`: `git ls-tree -r -l origin/main` returns none. So this is
a caught near-miss, not a landed regression — but it was caught by luck, not by design.

## Done when

- A reproduction: two branches editing disjoint regions of one file, run through the drain's rebase-drop
  auto-resolve, asserting the merged content contains **both** edits.
- The resolver refuses to emit a result that is empty, or that is smaller than both inputs, when neither input
  was empty — falling back to a real conflict (park the lane for a human) rather than a silent drop. A resolver
  that cannot merge should say so; "auto-resolved" must mean merged.
- A post-resolve assertion in the drain that is **not** content-type-specific, so the guard does not depend on
  the emptied file happening to be one with a validator.
- Check the other `auto-resolve` paths for the same shape — `git log --grep=auto-resolve` shows 11 commits since
  2026-07-01, and this failure mode would have been invisible in any of them.
