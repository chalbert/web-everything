---
bornAs: x9qfgz9
kind: story
size: 3
relatedTo: ["2216", "2189", "2199"]
status: open
dateOpened: "2026-07-13"
tags: [lane, pr-flow, drain, ci]
---

# Wire #2216's label reconciler into the parallel-execute Finalize — a labelled:false PR the drain can't see

A /workflow (parallel) batch can complete with a PR left labelled:false: when a lane's required checks outlast its pr-land --label-on-green wait, pr-land returns check-timeout and the PR is left open-but-unlabelled. The parallel-execute Finalize builds the ledger but never reconciles that PR, and the drain filters by the ready-to-merge label — so an unlabelled PR is invisible to it and strands until a human relabels it (observed this session: WE #450 for #2453, green CI, labelled:false, only the close caught it). This is #2216's liveness gap unwired in the parallel path. Fix: have Finalize re-run pr-land --label-on-green (or a lightweight label reconciler) for any labelled:false PR whose checks have since gone green, or report it as a definite carried outcome so /resume picks it up.
