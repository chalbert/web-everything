---
kind: story
size: 3
status: open
dateOpened: "2026-06-22"
locus: webeverything
tags: [locus-prefix, enforcement, tooling, backlog, pre-commit]
---

# Close the two locus-prefix enforcement gaps: CLI write-path + pre-commit hook

The #883 locus-prefix stack (#884 detector, #885 gate, the PreToolUse `--pre` deny hook) guards **only
the `Edit`/`Write` tools**, so bare code-path refs keep reaching close-out red through two paths nothing
actually fires on. #1389 built the *capability* to catch them but stopped short on both. The leaks this
session (#1364/#1454/#1455 — all in resolved-item `## Progress` prose) trace straight to gap (1).

**Gap (1) — the `we:scripts/backlog.mjs` write path is unguarded (genuinely new, not in #1389).**
`scaffold`/`resolve` write `--digest`, body, and `## Progress` content **straight to `fs`** — never through
the `Edit`/`Write` tools — so the load-bearing PreToolUse `--pre` hook never sees that content. This is the
dominant source: the prose the resolve CLI splices is exactly where bare refs land.
**Fix:** run `scanRepoLocusPrefixes` (from `we:scripts/check-standards-rules.mjs`) on the content the CLI is
about to write and refuse with the same message the `--pre` hook uses — shift-left at the dominant source
(the #883 "enforce at write-time" pattern, applied to the project's own CLI).

**Gap (2) — the `--staged` sweep exists but nothing invokes it (the unfinished half of #1389).** #1389 added
`lint:locus --staged` + wired `npm run lint:locus`, but left invocation **manual** ("run it before a
commit"). No git pre-commit hook runs it, so heredoc/`cat >>` appends and CLI writes still only fail at
`check:standards` close-out, long after they land.
**Fix:** wire a git pre-commit hook (`.husky/pre-commit` or `.git/hooks/pre-commit`) to `npm run lint:locus`
(exit 2 blocks the commit) — the catch-all backstop that fires regardless of *how* the ref reached disk.
Scoped correctly: agents stage only their own item's files (commit-each-piece rule), so it only ever blocks
the committing session on its own content.

Land both: the pre-commit hook is defense-in-depth (nothing escapes a commit); the CLI check is earlier,
clearer feedback at the actual source. They are complementary, not alternatives.

**Stretch (optional, rides on both above, not instead of them):** auto-prefix a bare ref with the item's own
declared `locus:` when unambiguous (the ~90% case — an item describes files in its own repo), falling back to
deny only when the token hints another repo or `locus` is absent. Removes the burden entirely for the common
case; conservative so a cross-repo citation (a `frontierui` item naming a `we:` file) isn't mis-prefixed.
