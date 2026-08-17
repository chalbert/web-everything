---
kind: task
status: open
relatedTo: ["1245", "1770"]
scope: ["we:blocks/router/"]
dateOpened: "2026-08-17"
tags: [constellation, placement, zero-impl, debt]
---

# Blocks/router (2843 lines) was #1245's declared first target and was never sliced

#1245 reads `status: resolved` but its own plan named `we:blocks/router/` as the first of sixteen named
debt-root families to slice out to Frontier UI, and only four of the sixteen were ever actually sliced. The
router debt — 2,843 lines across 19 files, including a 741-line types+fixtures cluster and a 619-line
`we:blocks/router/RouteViewElement.ts` — is still fully present under `we:blocks/`.

## Why this is a real gap, not a nicety

Surfaced during the 2026-08-17 prep pass on #1770 (constellation-placement audit): #1245's own
`blockedBy: [1353]` is itself stale (#1353 resolved 2026-06-27), and the prep found no evidence router was
ever touched. This is a specific, load-bearing instance of the broader pattern #1770 documents — a backlog
item that reads "done" while a class of debt it declared in scope is untouched — not a hypothetical.

## Done when

1. **Executable** — either `we:blocks/router/` is sliced to Frontier UI per #1245's original plan (verified by
   its absence, or by the WE-resident copy shrinking to a thin reference fixture matching #1245's other three
   completed slices' shape), or #1245 is reopened / amended to honestly reflect its actual remaining scope
   instead of reading fully done.
