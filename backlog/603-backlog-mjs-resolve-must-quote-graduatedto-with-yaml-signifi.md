---
type: issue
workItem: task
status: open
dateOpened: "2026-06-14"
tags: []
---

# backlog.mjs resolve must quote graduatedTo with YAML-significant chars

node scripts/backlog.mjs resolve --graduated-to=<v> splices v into frontmatter UNQUOTED. A value containing a colon-space, a hash, or a leading special char makes the YAML loader misparse the item — it silently vanishes from the projection, breaking every dependent's blockedBy resolution (surfaced only at the next check:standards run). Observed 3x in one batch (#558/#567/#570), each needing a manual quote-fix. Fix: have resolve (and scaffold --digest) quote/escape any value carrying YAML-significant characters before writing the frontmatter. Owner: scripts/backlog.mjs applyTransition / the frontmatter writer.
