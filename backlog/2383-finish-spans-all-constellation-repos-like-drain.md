---
kind: story
size: 3
status: resolved
relatedTo: ["2200", "2202", "2287", "2257"]
tags: [lane, finish, resume, merge-queue, cross-repo]
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
---

# `/finish` spans all constellation repos by DEFAULT (parity with `/drain`)

`/drain` sweeps the whole constellation (WE + frontierui + plateau-app) in one global `blockedBy` cascade
since #2287, but `/finish` (`we:scripts/lane-resume.mjs`) stayed **single-repo** — its `discover` ran one
un-`--repo`-scoped `gh pr list` on the cwd repo and `land` hardcoded `--this-repo`. So a stuck lane in
plateau-app or frontierui was invisible to `/finish` and had to be hand-finished (observed 2026-07-09:
plateau-app PRs #16/#17 — two conflicting monorepo-split lanes — landed only by a manual clone-rebase-resolve
because `discover` reported zero stuck lanes while looking only at WE).

**Change:** make `we:scripts/lane-resume.mjs` constellation-aware by reusing the SAME `resolveRepos` /
`CONSTELLATION_REPO_NAMES` that `we:scripts/merge-ai-prs.mjs` already exports (one source of truth, not a copy):

- `discover` resolves the repo set (constellation by default; `--this-repo` to scope; `--repos=a,b` explicit),
  loops each repo with `--repo`-scoped `gh pr list`, tags every lane with its `repo`, and merges all into one
  `blockedBy`-ordered plan. `resolvedItemSet` stays WE-local — the backlog is WE-global, so a remote lane's
  `blockedBy` resolves against the one backlog regardless of which repo the lane lives in.
- `readManifest` is repo-aware: local repo → local git; remote repo → the GitHub API (`gh api` reads the lane
  manifest off the PR's head ref, base64-decoded), mirroring the drain. Fail-soft to null so a **manifest-less**
  lane (plateau-app's own batch branches carry none) degrades to `item`/`blockedBy` null — unordered within its
  repo, exactly like the drain's orphan-PR handling, never a crash.
- `land` takes a `repo`: every `gh` call is `--repo`-scoped and the single-couple drain trigger targets that
  repo (`--repos=<slug>` for a remote repo, `--this-repo` for the cwd repo). A remote-repo manifest-conflict
  **defers** its rebuild to the drain (which is sibling-clone-aware, #2263) instead of running the local-only
  rebase-drop plumbing against the wrong clone.

**SKILL:** document the all-repos default + `--this-repo`/`--repos=`/`--repo=` flags, and record the per-repo
finisher gate/env — notably plateau-app's npm-**workspaces** `@plateau/*` link gap (a borrowed `node_modules`
from a pre-split primary has no `@plateau` scope → spurious "cannot resolve `@plateau/tooling`" that looks like
a lane bug but is an env gap CI's fresh install wouldn't hit).

**Note:** landing a frontierui/plateau PR still needs that repo's own required `test` check + a provisioned
sibling clone for any rebuild (#2242/#2263/#2317); without them a cross-repo lane surfaces but is left for its
author — the same graceful degradation `/drain` already has, not a regression introduced here.
