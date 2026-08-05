---
bornAs: xq4nv2t
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
scope: ["we:scripts/lib/rebase-drop-content.mjs", "we:scripts/lane-drain.mjs"]
---

# The drain's rebase auto-resolve can silently EMPTY a conflicted file instead of merging it

The drain rebases a stale `lane/*` branch onto `origin/main` and auto-resolves "non-overlapping content conflicts" (#2371). On 2026-08-05 that pass turned we:backlog/2909-blast-radius-misses-skills-src-editing-a-skill-s-source-scor.md into a **zero-byte file**: two sessions had edited different regions of the same item, and what got committed kept *neither* side. The commit message reported success. Only a downstream test caught it, and only because an empty backlog item happens to fail validation — a file with no validator would have landed empty.

**The pure merge library is not the culprit — the live write-back path is.** Feeding the exact same three conflict stages through the merge functions in [`we:scripts/lib/rebase-drop-content.mjs`](scripts/lib/rebase-drop-content.mjs) replays them **correctly** (reproduction below). So the merged text was computed fine and then lost between the library returning it and the commit being written — in the write-back path (`git hash-object -w --stdin` / `git update-index --cacheinfo`, and the cwd those run in). Whoever picks this up should start there, not in the merge algorithm.

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

## Reproduction — the library is correct, so the loss is downstream of it (verified 2026-08-05, re-verified twice)

1. `git merge-tree --write-tree 1eaa31c4 5adc3ec3` yields the three conflict stages for
   `we:backlog/2909-blast-radius-misses-skills-src-editing-a-skill-s-source-scor.md`:
   base `4d0a80fa` (2428 bytes), ours `ad261065` (4911 bytes), theirs `ad5f1d1b` (4343 bytes).
2. Feeding **those exact blobs** through `parseConflictStages` + `planContentMerges` in
   [`we:scripts/lib/rebase-drop-content.mjs`](scripts/lib/rebase-drop-content.mjs) returns `ok: true` with a
   correct merge of **6788 characters (6826 bytes UTF-8, 100 lines)** carrying both sides' edits.
3. Yet commit `836ae978` staged **`e69de29b`** — git's empty blob — for that path.

So the merge itself never failed. The content existed as a correct in-memory string and was destroyed on the way
to the index. Three suspects, all in the imperative git boundary: `git hash-object -w --stdin` receiving an
empty or already-closed stdin, `git update-index --cacheinfo` writing before the blob exists, or the commands
running in the wrong cwd (the sibling-clone case).

CI shard 4 caught it (`validateBacklogItem` errored on the empty item) and it was repaired by hand in `4f56822f`.

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

- The **write-back** path is instrumented enough to reproduce the drop live — not just the pure merge, which
  already replays clean. A regression test must drive the write-back over the `4d0a80fa` / `ad261065` /
  `ad5f1d1b` stage triple and assert the staged blob is the 6788-character result, not `e69de29b`.
- The drain **verifies** every content-resolved path after write-back: the blob it staged is byte-identical to
  the text the library returned, and it **aborts the rebase** rather than committing a mismatch.
- Belt-and-braces on the resolver too: it refuses to emit a result that is empty, or smaller than both inputs,
  when neither input was empty — falling back to a real conflict (park the lane for a human) rather than a
  silent drop. "Auto-resolved" must mean merged.
- A post-resolve assertion in the drain that is **not** content-type-specific, so the guard does not depend on
  the emptied file happening to be one with a validator. No zero-byte auto-resolve result is ever silent.
- Check the other `auto-resolve` paths for the same shape — `git log --grep=auto-resolve` shows 11 commits since
  2026-07-01, and this failure mode would have been invisible in any of them.
