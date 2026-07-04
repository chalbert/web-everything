---
kind: story
size: 3
parent: "2241"
status: open
blockedBy: ["2243", "2257"]
dateOpened: "2026-07-04"
tags: []
---

# Producer transport (pr-land + /pr) for plateau-app — landing/drain now central via #2257

Re-scoped by #2257 (user directive "1 skill"): the drain/merge LANDER is no longer copied per repo — the single WE lander (we:scripts/merge-ai-prs.mjs) is now repo-aware (`--all-repos`) and sweeps plateau-app's `ready-to-merge` PRs in one global `blockedBy` cascade, so `/drain` and `/merge` are NOT ported into plateau. The residual is the PRODUCER side only: a session working a plateau lane needs a way to open a gated self-approved PR. Decide + build ONE of: (a) centralize too — invoke we:scripts/pr-land.mjs with `--repo=chalbert/plateau-app` from wherever the producer runs (no copy), or (b) copy pr-land + `/pr` into plateau. Prefer (a) for symmetry with the central lander. Still blocked by the plateau CI `test` check (#2243 — the merge gate) and by #2257 (the central lander). Validate by opening one plateau ready-to-merge PR and landing it via the central `/drain --all-repos`.
