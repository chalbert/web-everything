---
bornAs: xqsdawl
kind: task
status: resolved
dateOpened: "2026-08-08"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
tags: [gate, footgun]
---

# Three false denies in the new tree-write guard arm

The #2788 guard arm over-denies in three narrow spots: BSD in-place edit with an empty suffix on a scratch path, any package-runner segment containing the word build, and bare eleventy with a non-build flag. All precision-only, each with a named remedy.

## Where this came from

Carved out of the PR #1021 re-review (#2788, the PreToolUse tree-write backstop). That review
swept 95 everyday commands and 41 attack spellings: 91 allowed, 41/41 denied, and the arm even
*removes* a false deny main has today. These three are the residue. All are precision-only —
none of them lets a write through — so #1021 landed and these were split out.

## The three

1. **BSD in-place edit with an empty suffix, on a scratch path.**
   `sed -i '' s/a/b/ <scratch-file>` is denied. The empty quoted token is counted as a file operand
   by `we:scripts/guard-bash.mjs#fileOperands`, and it also shifts the slice at
   `we:scripts/guard-bash.mjs:431` so the sed script itself reads as a write target.
   Fix: drop empty operands. Low urgency — there are zero such uses in the tree, and shell
   in-place editing is already discouraged in favour of the Edit/Write tools.

2. **The word `build` anywhere in a package-runner segment fires the arm.**
   `we:scripts/guard-bash.mjs#BUILD_TARGETS_G` scans the whole segment, so all of these deny:
   running the unit-test script against a build-named test file, linting a build-named source
   directory, installing a package whose name contains `build`, and `npm install
   --build-from-source`.
   Fix: scan only the runner's script-name argument position.
   **This is the one worth doing** — it is the only one an agent hits in ordinary work. Mitigated
   today because the house spelling `npx vitest run` plus a path is unaffected, even for the four
   build-named test files that exist.

3. **Bare `eleventy` with a non-build flag denies.**
   `eleventy --version`, `--help`, `--dryrun` are denied; the arm allows only an explicit
   scratch `--output=`. `--serve` and `--watch` also deny, and that half is correct — they really
   do write the site directory.
   Fix: a small non-build-flag allowlist.

## Severity

Friction, not a wedge. Every deny message names a working single-token remedy
(`MAIN_SESSION_BUILD_OK=1`, or changing directory into a lane clone first), so no session can get
stuck. Item 2 is the only one likely to be hit; 1 and 3 are near-theoretical.

## Done when

- All three spellings above are allowed, and the must-deny corpus still denies 41 of 41.
- Each fix lands as a row in the two-sided fixture corpus PR #1021 already added, so precision and
  recall stay tuned against each other.
