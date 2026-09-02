---
bornAs: x63kvwg
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-02"
tags: []
---

# Fuzz-test guard-bash git-add-enumeration equivalent spellings

PR #1816 review of #2968 found we:scripts/guard-bash.mjs denies git add -A/./--all and the enumerate-then-add sink shapes by exact spelling, and three equivalent spellings slipped through: ./ , combined short flags -Av/-vA, and git status -su piped to xargs git add. Fixed inline, but the class of gap recurs -- the KNOWN RESIDUAL GAPS comment above gitAddEnumerationReason in that same file already names more of it. Add a small fuzz/property test that, for each guarded operand, tries several equivalent shell spellings (a bare dot vs ./ vs ./. ; -A vs -vA vs -Av; -s vs -su) against reason()/decide() in we:scripts/guard-bash.mjs and asserts they all deny.

## Done when

1. **Executable** — a new test in we:scripts/__tests__/guard-bash.test.mjs (or a new
   we:scripts/__tests__/guard-bash-fuzz.test.mjs) that, for each of the three guarded operand families this
   item exists to keep honest — the bare-dot direct shape (`.`/`./`/`./.`), the combined-short-flag direct shape
   (`-A`/`-vA`/`-Av`), and the `git status` enumeration source (`-s`/`--short`/`--porcelain`/`-su`) — runs every
   listed spelling through `reason()`/`decide()` in we:scripts/guard-bash.mjs and asserts they ALL deny. The
   test fails on today's code with any ONE spelling reverted to its narrower pre-fix form (proving it actually
   pins the equivalence, not just one spelling).
2. The property is expressed generatively (a small table/loop over spellings x operand family), not four more
   copy-pasted literal cases — so a NEXT equivalent spelling for an existing family is one line to add, not a
   new test.
3. `npm run check:standards` stays green.
