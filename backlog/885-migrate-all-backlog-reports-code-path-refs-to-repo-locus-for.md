---
kind: story
size: 5
parent: "880"
status: resolved
blockedBy: ["884"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: scripts/check-standards-rules.mjs
tags: []
---

# Migrate all backlog + reports code-path refs to repo-locus form; flip the gate to error

One-time bulk rewrite of every code-path reference across backlog/*.md (867) + reports/*.md (150) to the <repo>: locus form via regex + locus inference: a path that resolves in WE's tree gets we:, else resolve against the frontierui / plateau-app trees. Log paths ambiguous across two repos for a manual disambiguation pass rather than guessing. Then flip the #884 detection check from warn to error so check:standards stays green only on the migrated corpus. Finishes #841. Slice C of #880, blocked by the #884 gate it must satisfy.

## Progress (resolved 2026-06-18, batch-2026-06-18)

- **Corpus migrated** — a one-time script (built off the #884 `scanRepoLocusPrefixes` matcher: same
  `PATHLIKE_RE`, same fenced-block / markdown-link / `@scope` / URL / exempt-frontmatter carve-outs)
  marked **6,300 tokens across 905 files** with a `<repo>:` prefix. Inference was **WE-first** per the
  #884 ruling (resolves in WE → `we:`, else `fui:`, else `plateau:`), resolving by basename + path-suffix
  match against a `find`-built index of all three trees, with leading-`/` and `../<repo>/` prefixes
  stripped before resolution.
- **Detection-regex false positives fixed (remediation, surfaced mid-migration)** — the #884 matcher
  over-matched three non-path classes that a blind mark would have corrupted (e.g. `we:Node.js`). Added
  three carve-outs to `scanRepoLocusPrefixes` **and** the migration, kept identical so the flip stays
  green: **glob masks** (`*.test.ts` — a `*` before the token), **JS-ecosystem product names**
  (`Node.js`/`Next.js`/`Three.js` — `/^[A-Z][a-z]+\.js$/`), and **bare type-suffix fragments**
  (`.d.ts`/`.spec.ts` — `/^\.(?:d|test|spec|stories|sw\.spec)\.[a-z]+$/`). A new test covers all three
  (and asserts `we:.eleventy.js` / real `.js` paths are still flagged). 148 rule tests green.
- **Gate flipped to ERROR** — `REPO_LOCUS_PREFIX_ENFORCED = true` in
  `we:scripts/check-standards-rules.mjs`. `check:standards` is **0 errors** on the migrated corpus; an
  unmarked code-path now hard-fails. Finishes #841.
- **Disambiguation pass logged** — **0** tokens resolved in both FUI and plateau (no genuine cross-repo
  ambiguity). **394** tokens (237 distinct) resolved in no tree and were defaulted to `we:` — almost all
  WE-historical (`we:base.html`, removed in #795) or WE-conceptual/future paths, where `we:` (the backlog's
  own home repo) is correct. Full fenced list →
  [we:reports/2026-06-18-locus-migration-lowconf.md](/reports/2026-06-18-locus-migration-lowconf.md); a
  low-priority human spot-check is filed as **#909**.
