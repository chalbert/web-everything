---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
scope: ["we:scripts/lib/rebase-drop-content.mjs", "we:scripts/lane-drain.mjs"]
---

# The drain content-resolve write-back can land an EMPTY blob where the pure merge library replays clean

The drain's rebase auto-resolve reported "auto-resolve non-overlapping content conflict(s)" and wrote a **zero-byte** file. The pure merge in [`we:scripts/lib/rebase-drop-content.mjs`](scripts/lib/rebase-drop-content.mjs) replays the exact same three stages correctly, so the content was dropped somewhere in the live **write-back** path (hash-object / update-index / the sibling-clone cwd), not in the merge itself. Any lane the drain content-resolves can silently lose a whole file.

## Reproduction (verified 2026-08-05)

The lane was `lane/2909-blast-radius-source-trees`; the drain rebase commit was `836ae978`.

1. `git merge-tree --write-tree 1eaa31c4 5adc3ec3` yields the three conflict stages for
   `we:backlog/2909-blast-radius-misses-skills-src-editing-a-skill-s-source-scor.md`:
   base `4d0a80fa`, ours `ad261065`, theirs `ad5f1d1b`.
2. Feeding **those exact blobs** through `parseConflictStages` + `planContentMerges` in
   [`we:scripts/lib/rebase-drop-content.mjs`](scripts/lib/rebase-drop-content.mjs) returns `ok: true` with a
   **6788-byte** merged result. The library is correct.
3. Yet commit `836ae978` wrote **`e69de29b`** — git's empty blob — for that path.

CI shard 4 caught it (`validateBacklogItem` errored on the empty item) and it was repaired by hand in `4f56822f`. Had the emptied file been one the gate does not validate, it would have landed silently.

## Why it matters

This is a **silent data-loss** class in the one component that is the sole serial writer to `main` (#2290). The failure is invisible to the drain itself: it reports a successful auto-resolve. It was only caught because the emptied file happened to be a backlog item, which `check:standards` validates for shape. A source file, a test, or a doc emptied the same way merges green.

## Done when

- The live write-back path is instrumented enough to reproduce the drop (the three suspects: `git hash-object -w --stdin` receiving an empty/closed stdin, `git update-index --cacheinfo` writing before the blob exists, or the command running in the wrong cwd — the sibling-clone case).
- The drain **verifies** each content-resolved path after write-back: the blob it staged is byte-identical to the merge result the library returned, and it **aborts the rebase** rather than committing a mismatch.
- A regression test drives the write-back (not just the pure merge) over the `4d0a80fa` / `ad261065` / `ad5f1d1b` stage triple and asserts a 6788-byte result.
- No emptied-file drop is silent: an auto-resolve that produces a zero-byte result where either side was non-empty must fail loudly.
