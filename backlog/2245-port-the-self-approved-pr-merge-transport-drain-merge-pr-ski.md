---
kind: story
size: 3
parent: "2241"
status: resolved
blockedBy: ["2243", "2257"]
dateOpened: "2026-07-04"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
tags: []
---

# Producer transport (pr-land + /pr) for plateau-app — landing/drain now central via #2257

Re-scoped by #2257 (user directive "1 skill"): the drain/merge LANDER is no longer copied per repo — the single WE lander (we:scripts/merge-ai-prs.mjs) is now repo-aware (`--all-repos`) and sweeps plateau-app's `ready-to-merge` PRs in one global `blockedBy` cascade, so `/drain` and `/merge` are NOT ported into plateau. The residual is the PRODUCER side only: a session working a plateau lane needs a way to open a gated self-approved PR. Decide + build ONE of: (a) centralize too — invoke we:scripts/pr-land.mjs with `--repo=chalbert/plateau-app` from wherever the producer runs (no copy), or (b) copy pr-land + `/pr` into plateau. Prefer (a) for symmetry with the central lander. Still blocked by the plateau CI `test` check (#2243 — the merge gate) and by #2257 (the central lander). Validate by opening one plateau ready-to-merge PR and landing it via the central `/drain --all-repos`.

## Resolution (2026-07-09) — option (a), no per-repo copy; validated by plateau-app PR #6

Decided **(a)**, matching the FUI twin (#2244): the producer side stays centralized — no pr-land/`/pr`
copy lands in plateau-app. A session on a plateau-app lane opens its gated self-approved PR by invoking
the single WE `we:scripts/pr-land.mjs` against the plateau-app checkout (`--repo=<plateau-app-lane-path>`);
`gh` infers the `chalbert/plateau-app` GitHub repo from that checkout's remote, `--base` defaults to its
`main`. No code residual — pr-land is already repo-agnostic (`REPO = resolve(expandHome(flags.repo) ||
process.cwd())`, `we:scripts/pr-land.mjs:103`; confirmed live with a `--repo=<plateau-app-clone> --dry-run`
invocation that correctly planned a plateau-app-side push + PR), and the central lander is already repo-aware via
`--all-repos` (#2257, resolved).

Both blockers cleared on origin/main: #2243 (plateau-app required `test` check) and #2257 (central
repo-aware lander) are resolved. **End-to-end proof:** plateau-app **PR #6** (`ci(#2243): add required
'test' CI check (vitest + render-conformance)`, merged 2026-07-07) was opened via the central pr-land
from a plateau-app lane clone, carried the pipeline's `ready-to-merge` + `review:pending` labels, and
landed through the central drain cascade — exactly the validation this item specifies. Resolving as
covered; no plateau-app or WE code changes are needed beyond this note.
