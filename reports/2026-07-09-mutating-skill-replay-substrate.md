# Execution substrate for replaying a mutating skill/script under test

**Date:** 2026-07-09 · **Prep session:** `/prepare all` · grounds decision **#2274** (child of the #2268
validation-suite epic).

## The question

The #2268 validation suite must run a **mutating** skill/script and assert on its effect **without leaving
state behind**. #2274 asks the execution substrate: a `--dry-run` retrofit on every script (Fork A), or replay
the real skill in an ephemeral, revertible checkout (Fork B)?

## Grounding digest (verified)

- **Fork A-vs-B is already settled by the parent epic.** `we:backlog/2268-validation-suite-for-skills-and-memory.md:30-36`
  prescribes *"replaying the real skill in an ephemeral, revertible git worktree"* for Tier B and
  *"golden/snapshot tests"* for Tier A — *"realized as worktree-replay **rather than** a per-skill `--dry-run`
  retrofit (see #2274)."* So #2274 is a **ratify** of B + a **substrate** decision, not an open A-vs-B choice.
- **The two tiers.** `we:scripts/lib/invariant-catalogue.json:8-11`: **Tier A** = *"Deterministic script/hook
  layer — pure input (files/argv) to (files/exit code); CI-able golden/snapshot tests."* **Tier B** =
  *"Judgment skill layer (batch/drain/finish/next/review-program) — no deterministic output; validated by
  worktree-replay + invariant assertion, not snapshot."* Children: **#2273** Tier-A snapshot harness, **#2272**
  Tier-B session-replay (`we:backlog/2272-...md:6,13`).
- **"worktree" is guard-blocked — the primitive is a lane CLONE.** `{#…isolate-by-clone}`
  (`we:docs/agent/platform-decisions.md:2497-2498`, #1153): the branch guard *"denies `git switch`/`checkout
  -b`/`worktree add` in the shared checkout, forcing clones."* The prior-art report
  `we:reports/2026-07-02-solo-session-worktree-lane-prior-art.md:21` settles it: *"the isolation primitive is a
  lane CLONE, not a worktree … #1996 codified 'isolation = a clone'."* So the epic's word "worktree" must be
  read as **lane clone**.
- **The clone machinery is cheap and already leased.** `we:scripts/lane-pool.mjs:13-18`: lanes share git
  objects with the primary via `git clone --reference`, so a clone *"costs little disk and clones fast … Node
  deps (`node_modules`) are NOT shared — `ensureDeps` runs `npm ci` per lane on a fresh clone."* So the **real
  per-replay cost is the `npm ci` on a cold clone**, not the clone itself. `acquire` (`we:scripts/lane-pool.mjs:287-353`,
  #2275) leases a free lane **exclusively** + resets to origin/main; `release` (`:525-546`) drops the lease —
  an exclusive lease already prevents cross-session contention.
- **The `--dry-run` retrofit surface is large + lopsided.** Only **11 of 49** `we:scripts/*.mjs` carry
  `--dry-run` today (all already git-mutating, e.g. `we:scripts/pr-land.mjs:51`, `we:scripts/lane-drain.mjs:44`);
  ~38 would need retrofit, and the heaviest-mutating skills (drain/finish/pr) would test a **stubbed** path — a
  strictly weaker proof (the proven path is not the shipped path).
- **Tier-A replay of pure logic already exists.** `we:scripts/mine-golden-corpus.mjs` (#2270) replays the real
  pure settle/transition logic and *"keep[s] only if it reproduces"* the historical `after` byte-for-byte — the
  snapshot mechanism Tier A needs, no `--dry-run` involved.

## Finding (post-skeptic, post-screen)

**Reject Fork A (ratify B, already settled by #2268). Correct "worktree" → lane clone (#1153). The open
substrate decision: for Tier-B judgment skills, use a *leased warm validation-lane pool* (#2275), isolated from
production by a *throwaway local bare origin* for the remote-mutating skills.** My first-draft "dedicated cold
clone per replay, to avoid lease contention" was **refuted**: contention is already solved by #2275's exclusive
lease, and a fresh clone per replay pays the cold `npm ci` **every** replay, whereas a warm leased lane
amortizes deps — so cold-clone-per-replay is strictly slower for a suite that replays many skills. The *real*
reason to isolate is **remote blast-radius**: drain/finish/pr replay the *real* skill, which pushes `lane/*`
refs and merges PRs against the real origin — you cannot faithfully replay those in a production-pool lane
whose `origin` is real GitHub. So the substrate is: a **warm, leased validation-lane pool pointed at a
throwaway local bare origin** for the push-y skills (drain/finish/pr); a plain leased pool lane for non-remote
skills (next/review-program). Tier-A pure scripts use golden/snapshot tests (no `--dry-run`); the git-mutating
Tier-A ops (e.g. `we:scripts/backlog.mjs` scaffold/resolve) get a cheap scratch `git init` tree, not a full
lane.

Rejected: **`--dry-run` retrofit** (settled against by #2268; unfaithful for the git-mutating skills that are
the whole point; unnecessary for Tier-A, which snapshots cover more faithfully by running the *real* write
path); **overlayfs / copy-on-write / container** (faithful, but a substrate the constellation doesn't use — the
settled primitive is the clone).

- Skeptic: **SURVIVES-WITH-AMENDMENT** — A-vs-B is a ratify (#2268); the "dedicated clone to avoid contention"
  reason was refuted (#2275 lease solves contention; cold `npm ci` per replay loses on cost); folded in the
  throwaway-origin isolation for the remote skills and the git-mutating-Tier-A scratch-tree caveat.
- Screen: **CLEAR** — observable (whether shipped scripts carry a `--dry-run` flag) and merit-bearing
  (faithfulness — replaying the real mutation vs a simulated path).

## Net

#2274 = ratify worktree-replay (B) + correct "worktree" to a lane clone + adopt a leased warm validation-lane
pool isolated by a throwaway origin for the push-y skills. No `--dry-run` substrate is built.
