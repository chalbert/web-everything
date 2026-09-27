---
bornAs: xaltwl6
kind: task
parent: "4075"
status: open
scope: ["we:scripts/operations/deliver-item-wrapper.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# commitBuildTurn passes git-quoted filenames literally to git add, breaking wrapper-owned commits

Still-open Codex advisory finding from chalbert/web-everything#2758 (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-26). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: commitBuildTurn (we:scripts/operations/deliver-item-wrapper.mjs) calls runFn(git, [add, --, ...paths], {cwd: lane}) with paths taken verbatim from convergeRoundTouchedFiles, which reads them off git status --porcelain via path = line.slice(3).trim(). Porcelain quotes any path containing a space, quote, or non-ASCII byte (C-style quoting, wrapped in double quotes with backslash escapes) — that quoted/escaped string is passed straight to git add as a pathspec, which git does not accept as a literal path, so the add (and the following git commit) fails and the wrapper delivery build enters failure cleanup instead of committing real work.

EVIDENCE: read we:scripts/operations/deliver-item-wrapper.mjs directly off origin/main; convergeRoundTouchedFiles body is unchanged from the PR diff, and commitBuildTurn still does the same add call with the same porcelain-derived paths.

PREVENTION (from the reviewer, still owed): parse git status --porcelain=v1 -z (NUL-delimited, unquoted) instead of the display-formatted porcelain text, and add a deterministic test covering a touched filename with a space and one with a non-ASCII character.

Priority: not HIGH (breaks one delivery build attempt; does not close/resolve a wrong PR, does not lose data, does not suppress healing forever).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
