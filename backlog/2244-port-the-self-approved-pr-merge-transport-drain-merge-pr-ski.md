---
kind: story
size: 3
parent: "2241"
status: resolved
blockedBy: ["2242", "2257"]
dateOpened: "2026-07-04"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
tags: []
---

# Producer transport (pr-land + /pr) for frontierui — landing/drain now central via #2257

Re-scoped by #2257 (user directive "1 skill"): the drain/merge LANDER is no longer copied per repo — the single WE lander (we:scripts/merge-ai-prs.mjs) is now repo-aware (`--all-repos`) and sweeps frontierui's `ready-to-merge` PRs in one global `blockedBy` cascade, so `/drain` and `/merge` are NOT ported into FUI. The residual is the PRODUCER side only: a session working a frontierui lane needs a way to open a gated self-approved PR. Decide + build ONE of: (a) centralize too — invoke we:scripts/pr-land.mjs with `--repo=chalbert/frontierui` from wherever the producer runs (no copy), or (b) copy pr-land + `/pr` into FUI. Prefer (a) for symmetry with the central lander. Still blocked by the FUI CI `test` check (#2242 — the merge gate) and by #2257 (the central lander). Validate by opening one FUI ready-to-merge PR and landing it via the central `/drain --all-repos`.

## Resolution (2026-07-07) — option (a), no per-repo copy; validated by FUI PR #12

Decided **(a)**: the producer side stays centralized like the lander — no pr-land/`/pr` copy lands in frontierui. A session on a frontierui lane opens its gated self-approved PR by invoking the single WE `we:scripts/pr-land.mjs` against the FUI checkout (run from the FUI lane clone / `--repo=<fui-lane-path>`); `gh` infers the `chalbert/frontierui` GitHub repo from that checkout's remote, and `--base` defaults to the FUI default branch. No code residual — pr-land is already repo-agnostic (`REPO = flags.repo || process.cwd()`, `we:scripts/pr-land.mjs:95`), and the central lander is repo-aware via `--all-repos` (#2257, resolved).

Both blockers cleared on origin/main: #2242 (FUI required `test` check) and #2257 (central repo-aware lander) are resolved. **End-to-end proof:** frontierui **PR #12** (`ci: add CI workflow with a required test check`, merged 2026-07-07) was opened via the central pr-land from a FUI lane clone, carried the pipeline's `ready-to-merge` + `review:pending`/`review:accepted` labels, and landed through the central `/drain --all-repos` cascade — exactly the validation this item specifies. Resolving as covered.
