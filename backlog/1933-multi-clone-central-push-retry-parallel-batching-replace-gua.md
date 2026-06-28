---
kind: epic
parent: "1143"
status: active
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
tags: []
---

# Multi-clone + central push/retry parallel batching (replace guard-blocked worktree model)

True-parallel batching via N independent clones (own HEAD, guard-immune) that push lane work to `lane/*` temp branches on origin, with a central integrator merging one-at-a-time into main (gate per merge, rebase-and-retry on conflict). Replaces the worktree-isolation orchestrator, which is structurally blocked by the git-branch guard hook (#1153 4th-run finding). Build order: guard carve-out → lane-clone provisioning → orchestrator rewrite → cross-repo lanes.

## Why (the #1153 finding)

The existing parallel orchestrator (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`) isolates concurrent lanes with `git worktree add` and assembles on a throwaway `batch-parallel/*` branch. The user-global git-branch guard hook denies **both** `git worktree add` and branch creation in the shared checkouts (it protects the shared HEAD across concurrent sessions). So the 4th real run (`batch-parallel-2026-06-28`) collapsed: integration/merge/reconcile failed, lanes stranded, work salvaged manually onto main. Worktree isolation cannot work under that guard.

The clone-based model sidesteps the guard entirely: **each lane is its own clone with its own HEAD**, so no shared-HEAD hazard exists, and convergence happens through the remote (push to a temp branch) instead of through one working tree. The guard's `push`-deny only needs a narrow carve-out (`lane/*` refs, never `main`), since pushing a lane's commits to a throwaway remote branch is just transport.

## Scope decision (solo dev)

Per the #1153 4th-run finding, for a **solo dev** the day-to-day model stays **two sessions × serial `/batch` on disjoint items** — the worktree machinery guards contention that barely exists. This epic is the *true-parallel* path for when scale (team/CI) justifies it; it is **not** a prerequisite for normal batching. Build it deliberately, not urgently.

## Architecture (target)

- **Convergence** = the remote (`origin` = `git@github.com:chalbert/web-everything.git`). Push auth is solved (ssh-agent + macOS Keychain, prompt-free).
- **Per concurrent item** — a lane clone: `cd <lane-clone>` → claim is pre-assigned (see Design choices, item 2) → work → gate (`check:standards` etc.) → commit explicit paths → `git push origin HEAD:lane/<slug>-<n>`.
- **Central integrator** (the primary checkout): `git fetch origin "lane/*"` → merge each `lane/*` into `main` one-at-a-time with a **full gate per merge** → **rebase-and-retry** on conflict (never force) → delete the remote temp branch → regenerate derived artifacts (`we:AGENTS.md`, `we:src/_data/referenceIndex.json`) once at the end.

## Design choices (defaults set; revisit at build, not open ratification forks)

These are pre-decided with a recommended default each — captured for build, not awaiting a decision turn. Promote one to a `type:decision` card only if building reveals a genuine binary call.

1. **Clone lifecycle** → **persistent lane pool** (N long-lived clones under e.g. `~/workspace/.lanes/`, `git fetch` + hard-reset to origin/main each batch, objects shared via `git clone --reference`), not ephemeral clone-per-batch. Persistent avoids re-cloning a large repo every run.
2. **Claim/reservation coordination** → the orchestrator **claims ALL items up front in the central checkout, then dispatches; lanes never touch claim files** — they just work their assigned item. (`we:.claude/skills/batch-backlog-items/claims.json` is a committed file, so per-lane claim+push+retry would race — rejected.)
3. **Guard scoping** → make the git-branch guard hook **path-aware**: full denial only in the primary shared checkouts; allow branch/push inside lane-clone dirs (e.g. under `~/workspace/.lanes/`), and allow `git push` to `lane/*` (+ `batch-*`) refs while **still denying push to `main`**.

## Slices (carve as we build)

1. **Guard carve-out** — path-aware guard + `lane/*` push allow; smallest slice, unblocks the rest. (Touches the user-global hook + its allowlist.)
2. **Lane-clone provisioning** — script to create/refresh the persistent lane pool (`--reference`-shared, fetch+reset).
3. **Orchestrator rewrite** — replace worktree-add with lane-clone dispatch + push; central fetch/merge/rebase-retry/cleanup; derived regen once. Reuses the existing ledger + #1869 ledger-vs-tree reconcile.
4. **Cross-repo lanes** — items with impl in `frontierui`/`plateau-app` need lane clones of those repos too (the constellation). v1 may scope to WE-only items to ship sooner.

## Carries / known subtleties

- **Cross-repo** (slice 4) is the hard part — the constellation (WE → frontierui → plateau-app) means a single item often spans repos; clone-per-lane multiplies per repo.
- **Derived artifacts + monolithic registries** — same once-only-regen and serial-lane-for-monolith constraints as the worktree model carry over (see the orchestrator header's effects-manifest notes).
- **`multiLaneFiles` detection** must run against the assembled tree (the worktree run's detector missed a real `we:src/_data/intents/surface.json` overlap because the tree never assembled).

## Progress

- **Status:** active — design forks resolved, build underway.
- **Decisions (all resolved):** #1935 merge-risk reservation, #1936 cross-session lock primitive, #1937 gate location.
- **Slices:**
  - ✅ **1** — guard carve-out (#1934, resolved): `lane/*` + `batch-parallel/*` push allowed; main still denied.
  - ✅ **2** — lane-clone provisioning (#1940, resolved): `we:scripts/lane-pool.mjs` — persistent `--reference`-shared pool under `~/workspace/.lanes/<repo>/`, fetch+reset refresh, repo-parameterized for slice 4. 14/14 verify.
  - ⬜ **3** — orchestrator rewrite: replace worktree-add with lane-clone dispatch (consume `lane-pool list`/`path`) + push to `lane/*` + central fetch/merge/rebase-retry/cleanup + derived regen once. Reuses the #1869 ledger reconcile. **Next slice.**
  - ⬜ **4** — cross-repo lanes (frontierui/plateau-app); v1 may scope WE-only to ship sooner.
