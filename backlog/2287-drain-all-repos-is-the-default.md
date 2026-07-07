---
kind: story
size: 2
status: resolved
relatedTo: ["2257", "2162"]
tags: [lane, drain, merge-queue, cross-repo]
dateOpened: "2026-07-05"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
graduatedTo: none
---

# `/drain` sweeps all constellation repos by DEFAULT (all-repos, opt out with `--this-repo`)

#2257 made the single `/drain` lander repo-aware (`--all-repos` expands to the constellation:
`we:scripts/merge-ai-prs.mjs` `resolveRepos`), but left the constellation sweep **opt-in** — a bare
`/drain` only swept the cwd repo. Since the backlog is WE-**global** (a frontierui PR can be `blockedBy` a
WE item), a single global cascade over all repos is the *correct* default, not an optional flag — a
per-repo-scoped drain can never sequence a cross-repo `blockedBy`.

**Change:** flip the default in `resolveRepos` — with neither `--repos=` nor `--this-repo`, resolve to the
constellation (self first). Add a `--this-repo` opt-OUT for a deliberately scoped single-repo drain.
`--repos=a,b` still wins (explicit override); an underivable owner (no `self` slug) still falls back to
`[null]` (safe single-repo). Keep `--all-repos` accepted as a harmless no-op (it's the default now) for
back-compat. Update the `/drain` SKILL canonical invocation (drop `--all-repos`, document `--this-repo`) and
the `resolveRepos` unit tests to assert the new default.

**Note:** landing a frontierui/plateau PR still needs that repo's own required `test` check + branch
protection (#2242/#2243/#2246); until those exist, cross-repo PRs surface as `skip (required check "test" is
not green)` — considered by the cascade, not merged.
