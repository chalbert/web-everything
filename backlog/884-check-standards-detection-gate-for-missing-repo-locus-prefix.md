---
type: issue
workItem: story
size: 5
parent: "880"
status: resolved
blockedBy: ["883"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: scripts/check-standards-rules.mjs
tags: []
---

# check:standards detection gate for missing repo-locus prefixes (warn-level)

Add a check to we:scripts/check-standards.mjs that scans the existing raw backlog/*.md (:443) and reports/*.md (:591) loops for path-like tokens — regex [\w./-]+\.(ts|tsx|js|mjs|cjs|json|md|njk|css|html|yml|yaml)(:\d+(-\d+)?)? — and flags any lacking a <repo>: locus marker. False-positive carve-outs: fenced code blocks, @scope/pkg specifiers, URLs, and the relatedReport/graduatedTo/crossRef frontmatter fields (WE-relative by construction). Emits WARNINGS only so the build stays green on the un-migrated corpus; #885 flips it to error after migration. Slice B of #880, enforces the #883 convention.

## Progress (resolved 2026-06-18)

- **`scanRepoLocusPrefixes(docs)`** in `we:scripts/check-standards-rules.mjs` — pure scan for code-path tokens lacking a `<repo>:` locus marker, with the #880 carve-outs: fenced code blocks, markdown-link targets (`[we:path](path)` — the text carries the locus), `@scope/pkg` npm specifiers, URLs, and the WE-relative frontmatter fields (`relatedReport`/`graduatedTo`/`crossRef`). Inline backtick code is NOT exempt (a path in backticks still needs the prefix). `REPO_LOCUS_PREFIX_ENFORCED=false` → WARN; #885 flips to ERROR.
- **Wiring** — new §6f in `we:scripts/check-standards.mjs` reads `backlog/*.md` + `reports/*.md` and emits ONE aggregate warning (the un-migrated corpus has ~6.3k references across ~900 files — per-token would flood the gate).
- **6 rule tests** (flag-bare, accept-marked, link-target, @scope+URL, fenced+frontmatter, multi-count). Two regex bugs fixed en route: `json` mis-matching as `js` (added `(?![a-z])` guard + longer-first alternation) and the URL/`@scope` carve-outs (the `//`/scope sit inside the token, so the marker is at the end of `before`). `check:standards` green (0 errors); the aggregate warn is the #885 migration worklist.

Slice B of #880 done; #885 (corpus migration + flip to error) is the remaining slice.
