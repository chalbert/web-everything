---
kind: task
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/diff-hunks.mjs", "we:scripts/lib/__tests__/diff-hunks-context.test.mjs"]
dateOpened: "2026-09-19"
tags: [governance, mechanization, principle-surface]
---

# Pin an explicit context width on the two diff producers the marker grammar reads (-U3)

Follow-on to #2892. The marked-block grammar (`MARKED_BLOCK_MAX_LINES` = 3 in `we:scripts/lib/gate-config.mjs`)
assumes each hunk carries 3 lines of context. Today that rests on git's default: a runner git config with
`diff.context` set lower would silently hide a marker from a hunk, and the additive marker term would under-fire
with no signal.

## Scope

- Pass an explicit `-U3` in `computeNetDiffText` (`we:scripts/merge-ai-prs.mjs`) and in
  `computeProposedFileDiffText` (`we:scripts/lib/diff-hunks.mjs`).

## Edge cases the build must handle or reject

- A configured `diff.context` LARGER than 3 must be overridden to exactly the pinned width, not left to default
  when unset (an explicit flag beats config; verify with `git config diff.context=9` in the test repo).
- The existing argv-shape tests key on the git-diff intent, ignoring only `--end-of-options` / `--verify` /
  `--no-ext-diff`; the new flag must be added to that filter, and the change must not require editing every
  fixture key.
- `computeProposedFileDiffText` diffs with `--no-index`; confirm `-U3` composes with `--text` and
  `--no-ext-diff` there.

## Done when

1. **Executable** — `npx vitest run diff-hunks-context` passes (vitest filters by substring; the file is
   `we:scripts/lib/__tests__/diff-hunks-context.test.mjs`). The test runs the REAL producers against a temp git repo
   whose config sets `diff.context=0`, feeds the text through `scoreEscalation`, and asserts a marked-block edit
   still yields `signals.markedInvariant`. It fails before the flag is pinned because the marker falls outside a
   zero-context hunk.
2. This item closes only the context pinning; it adds no new signals.
