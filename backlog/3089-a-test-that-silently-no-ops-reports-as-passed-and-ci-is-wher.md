---
bornAs: xfltq3j
kind: story
size: 1
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-13"
dateOpened: "2026-08-13"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
tags: [review, jury, isolation, test-coverage, footgun, follow-up]
scope:
  - we:scripts/lib/judge-spawn.mjs
  - we:scripts/lib/__tests__/judge-spawn.test.mjs
---

# A test that silently no-ops reports as passed, and CI is where it does

Four tests in `we:scripts/lib/__tests__/judge-spawn.test.mjs` bail with a bare `return` when the machine
cannot provide what they need — a case-insensitive filesystem, a macOS firmlink, a cross-volume inode
collision. **A bare `return` reports as ✓ passed**, so a test that ran nothing looks exactly like one that
ran.

Two conditions then compose into a hole. With the `dev` comparison dropped AND no collision available, the
suite is **fully green**. CI is `ubuntu-latest`, and four of the six candidate paths are macOS-only — so the
machine that gates every merge is the machine where the test defends nothing.

This is systemic in the file rather than introduced by any one change: the same idiom guards the headline
firmlink test. Named by PR #1197's reviewer, who proved the silent-pass mechanism by reducing the candidate
list and left the CI half as high-confidence inference rather than a measurement.

## Two halves, and only one is about reporting

**Make the no-op visible.** `ctx.skip()` reports as skipped; a bare `return` does not. That is a one-token
change per site and it turns an invisible gap into a visible one.

**But a visible gap is still a gap.** The point of the `dev` comparison is that it holds everywhere, so it
needs a test that runs everywhere. A real cross-volume inode collision cannot be constructed on demand —
inject `stat` instead, exactly as `realpath` is already injected in the same function.

## Watch for

- The real-collision test stays. It exercises the actual filesystem where one exists, which the stub cannot,
  and the two answer different questions.
- Injecting `stat` must not weaken the production path: the default stays `statSync`.

## Done when

- [x] `dev` is defended on a machine with no cross-volume collision.
- [x] A test that cannot run reports as skipped, not as passed.

## How it resolved

`sameDirectory` takes an injected `stat`, defaulting to `statSync` — the same shape `realpath` already had in
the same function, and for the same reason: the condition cannot be summoned on demand.

Both halves verified by simulating the CI machine, reducing the candidate list to `/` alone:

| | before | after |
| --- | --- | --- |
| `dev` dropped, no collision available | **89 passed** — defended nothing | **1 failed** |
| no collision available, code intact | 89 passed — invisible | 88 passed, **1 skipped** |

The first row is the fix. The second is the honesty: `ctx.skip()` makes a no-op show up, where a bare
`return` reported it as a pass.

All four bare returns in the file are converted, not just the one this came from — the same idiom guards the
headline firmlink test, so it silently no-opped on Linux too.
