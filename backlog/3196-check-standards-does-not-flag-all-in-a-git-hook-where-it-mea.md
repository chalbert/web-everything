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

**`--all` is matched as a WORD, not by boundaries**, and getting there took two review rounds that each found
another shell-valid way of writing the same argument. The first cut looked for `--all` with the right
characters either side: round 1 accepted only whitespace, `=` or end-of-line as a terminator, so a trailing
`;` — in a file full of `if …; then` — was missed; round 2 still required whitespace or start-of-line BEFORE
the flag, so `"--all"`, a backtick-adjacent form and `--all,foo` were missed too. Same defect both times, and
the worst shape this gate can have: silently not reporting the real line while a passing run reads as coverage.

Round 3 found two more: a backslash-escaped dash (`\--all` — unquoted, `\-` is simply a literal `-`, so argv
is exactly `--all`), and an escape marker matched against the RAW line, so the phrase appearing inside a string
suppressed a genuine invocation on that same line. Round 4 found `}`, in an entirely ordinary
`${VAR:-node x --all}` default expansion.

FOUR ROUNDS, FOUR MISSING CHARACTERS, ONE SHAPE. Enumerating separators means being wrong until somebody finds
the next character, and every wrong answer is a SILENT miss. So the set is now defined POSITIVELY — everything
that is not a word CHARACTER separates — which can only be wrong in the direction that reports: an unlisted
character splits, which at worst over-splits a word into pieces that are not the flag either. That inversion is
the actual fix; the three preceding rounds were each a patch on the wrong shape. So the question is now asked the way a shell asks it: split the code half
into WORDS and compare a whole word. Quote characters are removed rather than treated as separators, because
quoting — and escaping — are not part of the word. Replacing those characters with a SPACE rather than deleting
them is deliberate: it can only over-split, which reports, where deleting could weld two words into one that is
no longer the flag. `-` is deliberately NOT a separator, and that single omission is the entire reason
`--all-repos` and `--allow-dirty` stay out — they tokenize to themselves and simply are not `--all`.

The escape marker is read from the COMMENT half alone. A marker that can be triggered from code is not a
marker, whether the triggering is deliberate or accidental.

Round 5 closed the last class: forms that SPLICE the token rather than change its boundaries — `--al""l`,
`-"-all"`, `--a"ll"`, `-\-all`, and a `\`-newline continuation splitting the word itself. Quoting and escaping
are now REMOVED rather than replaced with a space, which is what the shell does: welding adjacent quoted
fragments into one word is shell behaviour, so the space was inventing a split the shell never makes. Physical
lines are joined across continuations first, each keeping the number of the line it starts on, because no
per-line scan can see a flag split across two. A backtick is treated differently from a quote and deliberately
so — it is SUBSTITUTION, not quoting, so it breaks the word; the expansion is unknowable here and an empty one
leaves exactly `--all`.

A continuation is decided by PARITY of the trailing backslash run, not by its presence — an even run is
escaped backslashes and the line ends. Testing for "ends with a backslash" welded the next line's head onto
this one's tail, so a bare `--all` immediately after such a line became `foo--all` and was missed. Over-joining
is the one direction in which this preprocessing can HIDE a flag rather than expose one, so it is the one place
the rule has to be exact rather than merely safe.

Removal is quote-blind, which over-reports in one known place: inside double quotes a backslash is literal
unless it precedes `$`, a backtick, `"` or itself, so `"\-\-all"` really passes `\-\-all` and is called a hit
anyway. Pinned as a test so it stays a decision rather than a surprise.

## What is NOT modelled, stated rather than discovered

This is a scanner, not a shell, and four review rounds is enough evidence that the remaining surface should be
named instead of assumed empty. Not handled: a flag assembled from a variable (`F=--all; node x $F`), `$IFS`
games, heredocs, and `"\-\-all"` — which is correctly a non-hit, because inside double quotes a backslash
escapes only `$`, a backtick, `"` and itself, so that form passes a literal `\-\-all` and not the flag. The
bias stays toward treating text as code: a false positive is a sentence in a review, a false negative is the
flag shipping again.

Verified live rather than only in fixtures: re-adding `--all` to `we:.githooks/post-merge` makes
`npm run check:standards` report that line and exit non-zero; removing it returns to 0 errors. Mutation-checked
in six directions, each on its own: dropping comment-stripping reddens 3, keeping quotes as separators reddens
2, splitting on whitespace alone reddens 2, prefix-matching instead of whole-word reddens 2, leaving the
backslash glued to its word reddens 2, reading the escape from the raw line reddens 1, reverting to the
enumerated separator list reddens 2, dropping `-` from the word charset reddens 12, replacing quotes and
escapes with a space instead of removing them reddens 3, removing the continuation join reddens 2, deleting
a backtick instead of breaking the word on it reddens 2, and testing continuation by presence rather than
parity reddens 1.

## Done when

1. **Executable** — a rule in `we:scripts/check-standards-rules.mjs` that reports an error for `--all` in any
   file under `we:.githooks/`. Re-adding the flag to `we:.githooks/post-merge` makes `npm run check:standards`
   exit non-zero; removing it passes.
2. The message says what the flag DOES ("creates the machine-global tree on a machine that never opted in"),
   not merely that it is disallowed — a rule a reader can only obey is a rule they will suppress.
3. A hook that legitimately needs the flag can say so inline, so the rule is a prompt and not a wall.
