---
type: issue
workItem: task
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: scripts/backlog/frontmatter.mjs quoteScalar() + applyTransition resolve-path quoting
tags: []
---

# backlog.mjs resolve must quote graduatedTo with YAML-significant chars

node scripts/backlog.mjs resolve --graduated-to=<v> splices v into frontmatter UNQUOTED. A value containing a colon-space, a hash, or a leading special char makes the YAML loader misparse the item — it silently vanishes from the projection, breaking every dependent's blockedBy resolution (surfaced only at the next check:standards run). Observed 3x in one batch (#558/#567/#570), each needing a manual quote-fix. Fix: have resolve (and scaffold --digest) quote/escape any value carrying YAML-significant characters before writing the frontmatter. Owner: scripts/backlog.mjs applyTransition / the frontmatter writer.

## Progress

- **Resolved 2026-06-14.** Added `quoteScalar(value)` to `scripts/backlog/frontmatter.mjs` —
  double-quotes a scalar iff it carries a YAML-significant char (a `:`/`#`, a leading indicator
  `-?:[]{}#&*!|>%@` `` ` `` `"'`/whitespace, trailing whitespace, or a newline), escaping embedded
  quotes; an already-quoted value passes through. `applyTransition`'s `resolve` path now wraps
  `graduatedTo` through it before splicing. Scaffold's `--digest` needs no fix — it renders into the
  **body**, not a frontmatter scalar. Covered by 6 new `frontmatter.test.mjs` cases (plain slug stays
  bare; colon/hash/leading-indicator quoted; embedded-quote escape; round-trips back via `readField`).
