---
name: committed-scripts-carry-nul-sentinels
description: "Three committed scripts hold DELIBERATE NUL bytes as string delimiters, so plain `grep` calls them binary and silently reports nothing — use `grep -a`. And `grep $'\\x00'` matches EVERY line (bash truncates the argument to empty); use `grep -P '\\x00'`. They are not Write-tool corruption — do not 'repair' them."
metadata:
  node_type: memory
  type: project
---

**Three committed scripts contain NUL bytes on purpose**, as in-string delimiters that cannot occur in the
data being delimited. Counted 2026-08-09:

| file | NULs | what they are |
|---|---|---|
| `scripts/guard-bash.mjs` | 1 | the never-a-wrapper token passed into the wrapper-peeling table (a value no real argv token can equal) |
| `scripts/backlog/renumber-collisions.mjs` | 4 | `CONTENT_SENTINEL` — the mask wrapped around each intended `#NNN` reference during the renumber |
| `scripts/lib/component-render-build-hook.cjs` | 2 | the per-card `sentinel(i)` template that survives happy-dom's `innerHTML` round-trip |

Note the paths: **two of the three are in subdirectories** (`scripts/backlog/`, `scripts/lib/`), not at
`scripts/<name>`.

**Consequence 1 — plain `grep` silently finds nothing in them.** A single NUL makes `grep` classify the whole
file as binary and suppress output, with **exit 1** and no warning that anything was skipped. Measured:
`grep -c lane scripts/guard-bash.mjs` → no output, exit 1; `grep -ac lane scripts/guard-bash.mjs` → `105`.
**Always `grep -a`** when searching `scripts/`, or a survey will under-report and read as authoritative.

**Consequence 2 — `grep $'\x00' <file>` matches EVERY line.** Bash's ANSI-C quoting builds a C string, so the
argument is truncated at the NUL and `grep` receives an **empty pattern**, which matches everything. Verified
on a two-line file with no NULs: `grep -c $'\x00'` → `2`. To actually find NULs use PCRE:
`grep -rlaP '\x00' --include='*.mjs' --include='*.cjs' scripts` returns exactly the three files above.
(This machine's `grep` is `ugrep` 7.5.0, which supports `-P`; GNU grep does too, BSD/macOS `/usr/bin/grep` does
not.)

**They are NOT Write-tool corruption — this is the attractive wrong hypothesis, and an agent reached for it on
2026-08-09.** Each NUL sits inside a quoted string literal with a comment directly above it explaining the
sentinel. Do not "repair" them, do not rewrite the files to strip them, and do not file corruption cards
against them.

Related: [[grep-every-name-you-cite-in-prose]] — a suppressed-binary `grep` is a way to cite a count that is
confidently wrong.
