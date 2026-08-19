---
bornAs: x8yzxdc
kind: task
status: resolved
dateOpened: "2026-08-19"
dateStarted: "2026-08-19"
dateResolved: "2026-08-19"
tags: []
---

# check:standards does not flag --all in a git hook, where it means the machine-global tree

`we:.githooks/post-merge` shipped a commands sync carrying --all. On that CLI --all does not mean "deploy every command" — it means "create the machine-global tree", on a machine that never opted in. A hook runs on every merge, on every clone, with nobody reading its output, so the wrong flag there is applied silently and repeatedly. It was caught by a reviewer, not by a check. Add a standards rule that flags --all appearing in any file under `we:.githooks/` and names what it actually does, so the next one is caught before it lands.

## How it was closed

Gate 17b in `we:scripts/check-standards.mjs` reads every file under `we:.githooks/` and runs a pure
`findGitHookAllFlags` from `we:scripts/check-standards-rules.mjs` over it. Only the directory read lives in the
gate; the rule is unit-tested against fixtures and against the live hooks.

**The comment half was the interesting part.** `we:.githooks/post-merge` already carries a long explanation of
why it deliberately does NOT pass the flag — the exact prose a substring scan reports as a violation, which
would make the rule fire hardest on the file that already got it right. So the detector strips the shell
comment from each line before looking, with enough quote tracking that `echo "a#b"` and `${x#y}` are not
mistaken for comment openers. It is a scanner and not a shell parser: heredocs and nested expansions are not
modelled, and the bias is deliberately toward treating text as CODE, because a false positive is a sentence in
a review while a false negative is the flag shipping again.

`--all` is matched as a passed FLAG, not as a word, so `--all-repos` and `--allow-dirty` are somebody else's
business. The TERMINATOR SET is where that matching lives, and the first cut got it wrong: it accepted only
whitespace, `=` or end-of-line, so a `--all;` on the commands-deploy line — a shell metacharacter closing the
word, in a file full of `if …; then` — invoked the CLI exactly as the incident did and was silently not
reported. The juror on PR #1488 found it. The set is now every character that can END a shell word, and a `-`
is deliberately still absent, which is what keeps the sibling flags out. The escape is `# standards-allow --all: <why>` on the line or the one above it — a rule a reader can
only obey is a rule they suppress wholesale, and naming the reason keeps the suppression legible.

Verified live rather than only in fixtures: re-adding `--all` to `we:.githooks/post-merge` makes
`npm run check:standards` report that line and exit non-zero; removing it returns to 0 errors. Mutation-checked
in three directions — dropping comment-stripping reddens 2 tests, loosening the flag boundary to a bare
substring reddens 1, and ignoring the escape reddens 2.

## Done when

1. **Executable** — a rule in `we:scripts/check-standards-rules.mjs` that reports an error for `--all` in any
   file under `we:.githooks/`. Re-adding the flag to `we:.githooks/post-merge` makes `npm run check:standards`
   exit non-zero; removing it passes.
2. The message says what the flag DOES ("creates the machine-global tree on a machine that never opted in"),
   not merely that it is disallowed — a rule a reader can only obey is a rule they will suppress.
3. A hook that legitimately needs the flag can say so inline, so the rule is a prompt and not a wall.
