---
kind: story
size: 3
parent: "1933"
status: resolved
scaffoldedBy: "1933-multi-clone-central-push-retry-parallel-batching-replace-gua"
dateScaffolded: "2026-06-28"
dateOpened: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
tags: []
---

# Slice 2: lane-clone provisioning — persistent reference-shared lane pool

Provision/refresh a persistent pool of N lane clones (under ~/workspace/.lanes/<repo>/lane-<n>) that the #1933 clone-based parallel orchestrator dispatches into. Each lane is a full clone with its OWN HEAD (guard-immune), sharing git objects with the primary checkout via 'git clone --reference' (fast, low-disk), refreshed each batch by fetch + hard-reset to origin/main. Repo-parameterized so cross-repo slice 4 (frontierui/plateau-app) reuses it. CLI: provision/refresh/status/list/path/remove. Deps (npm ci) ensured on fresh clones or lockfile change. Verify against a throwaway local bare repo (no network/big-clone needed).

## Progress

- **Status:** resolved
- **Impl:** `we:scripts/lane-pool.mjs` — the pool CLI (provision / refresh / status / list / path / remove). Pool-only: it creates & refreshes the clones; it does NOT dispatch, push, or merge (that's slice 3).
- **Done:**
  - **Provision** (`--count=N`): clones missing lanes via `git clone --reference <primary> <originUrl>`, so git objects are borrowed from the local primary (fast, low-disk — verified the lane's git `alternates` file points at the reference) and origin stays the real remote. Idempotent: existing lanes are kept, the pool grows to N. Refreshes all lanes + ensures deps as part of provision.
  - **Refresh** (existing lanes only): `git fetch origin --prune` → `git reset --hard origin/<branch>` → `git clean -fd` (no `-x`, so ignored `node_modules` survive — verified). Clobbers any local dirt back to origin/main so a lane is always a clean dispatch surface.
  - **Repo-parameterized**: keyed by repo NAME under `~/workspace/.lanes/<repo>/` (root overridable via `LANE_POOL_ROOT`); `--repo=<checkout>` / `--origin` / `--reference` / `--name` / `--branch` let cross-repo slice 4 (frontierui / plateau-app) reuse it unchanged. Default integration branch detected from the reference's `origin/HEAD`, else `main`.
  - **Deps** (`ensureDeps`): `node_modules` isn't shared by `--reference`, so each lane runs `npm ci` (or `npm install` w/o a lockfile) on a fresh clone or when the lockfile hash changes; a marker under the lane's `.git` (never tracked/cleaned) records the installed hash. `--no-install` skips. No-op when there's no Node manifest (`we:package.json`).
  - **status/list/path/remove** for the orchestrator: `status [--json]` reports per-lane head / clean / behind-origin / deps; `list [--json]` prints dispatch paths; `path --lane=N` resolves one; `remove --lane=N|--all` tears down.
- **Verify:** self-contained harness against a throwaway local bare repo (no network, no big clone) — 14/14 assertions pass: object-sharing alternates, HEAD==origin, deps n/a, fast-forward on new origin commit, hard-reset clobbers tracked+untracked dirt, ignored `node_modules` preserved, list/path correct, idempotent re-provision, grow 2-to-3, remove --all, bad `--count=0` rejected. Repo `check:standards` green.
- **Notes:** `we:scripts/lane-pool.mjs` lives in WE (orchestration tooling), but it operates on clones OUTSIDE the repo under `~/workspace/.lanes/`, so its runtime artifacts never touch the working tree. Next: slice 3 (orchestrator rewrite) consumes `lane-pool list`/`path` to dispatch, then pushes each lane to `lane/*` (the #1934 carve-out) for the central integrator to merge.
