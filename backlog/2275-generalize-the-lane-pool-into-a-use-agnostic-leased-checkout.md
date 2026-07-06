---
kind: epic
status: open
blockedBy: ["2267"]
relatedTo: ["2219", "2077", "1933", "1945", "2162"]
dateOpened: "2026-07-04"
relatedReport: reports/2026-07-05-2275-split-analysis.md
tags: [lane-pool, infra, pr-flow, productization]
---

# Generalize the lane pool into a use-agnostic leased-checkout allocator (migrate /drain + /merge off the bespoke clone)

Lanes today are implicitly producer-shaped and role-tinged; consumer flows like /drain hand-roll their own bespoke sibling clone in the user's workspace with no managed location, lifecycle, or cleanup. Reframe: a lane is a use-agnostic, isolated, leased checkout — the task (drain, merge, prepare, decide, batch, solo) is the consumer's business, not a property of the slot. Add exclusive-lease semantics (a held lane is never refreshed/recycled) so any flow can safely acquire then work then release, migrate /drain and /merge off the hand-rolled clone recipe onto the allocator, and make the checkout root allocator config (workspace vs managed dir vs remote runner) so no skill hardcodes a path.

## The reframe

A lane is **not typed by what runs in it.** There is no producer-lane vs consumer-lane — the only real
differences between uses are *which ref the checkout ends on* and *whether it opens a PR*, both decided by
the task, not baked into the slot. So the primitive is a single **use-agnostic, isolated, leased checkout**;
every flow (`/drain`, `/merge`, `/prepare`, `/decision`, `/batch`, solo `#2123`) is a consumer that
`acquire → reset --hard origin/main → do its thing → release`.

This kills two current warts:
- **The bespoke drain clone.** `we:scripts/merge-ai-prs.mjs` / the `/drain` + `/merge` skills hand-roll
  `git clone --local <primary> ../we-drain-clean` — a hand-named sibling in the *user's* workspace with no
  managed location, no lifecycle, no cleanup. It is the last hand-rolled instance of the exact abstraction
  `we:scripts/lane-pool.mjs` already provides for producers.
- **The false lifecycle objection.** The stated reason the drain *cannot* borrow a pool lane is that the
  pool refreshes / `reset --hard`s its lanes between batches and could yank the drain's tree mid-cascade
  (esp. `--watch`). That is a **missing lease primitive**, not a reason to type lanes: an exclusive lease
  (held ⇒ off-limits to refresh/recycle) fixes it use-agnostically, protecting a drain lease exactly like a
  batch lease.

## Slices (sliced 2026-07-06 — `relatedReport`)

Umbrella for making the pool a use-agnostic leased-checkout allocator, sliced along a real foundational seam:

1. **#2283 — Lease primitive (`acquire`/`release` exclusive hold). ✓ RESOLVED** (delivered via PR #167).
   Scope (1)+(2): `we:scripts/lane-pool.mjs` `acquire` (atomic `O_EXCL` claim of a `.git/.lane-lease` marker
   — lowest free lane or `--lane=N`, then `reset --hard origin/<branch>` so a leased lane may sit on `main`)
   + `release`; `refresh`/`provision` skip a live-leased lane (#2267); pure unit-tested
   `we:scripts/lib/lane-lease.mjs`. Consumer contract: `LANE_SESSION`/`--session` ties `acquire`↔`release`.
2. **#2282 — Allocator provisions writable `frontierui` + `plateau-app` sibling clones** (foundational for
   the migration). The pool root provides only a `frontierui` **symlink** today (render artifact) and no
   `plateau-app`; the drain's cross-repo rebase-drop needs **pushable** sibling clones. Extends the
   `ensureFuiSibling` pattern (`we:scripts/lane-pool.mjs:165-199`).
3. **#2303 — Migrate `/drain` + `/merge` onto the leased allocator (+ config root).** `blockedBy #2282`.
   Scope (3)+(4): the skills + `we:scripts/merge-ai-prs.mjs` `acquire → work → release` instead of
   `git clone --local … ../we-drain-clean`; delete the bespoke recipe; make the checkout root allocator
   config (no hardcoded `../we-drain-clean` / `.lanes` path).

DAG: `#2267 (✓) → #2283 (✓)`; `#2282` (free); `#2283 + #2282 → #2303`. Incremental delivery — each slice
lands valid on its own.

## Out of scope (follow-on — file separately if pursued)

- **Managed root outside the workspace.** Point the allocator root at an OS-standard data/state dir
  (`$XDG_STATE_HOME/we-lanes/<repo>/…`) instead of the in-workspace `.lanes` root so the user's workspace
  stays pristine and the flow is portable to a machine with no "workspace". This story only makes the root
  *configurable*; choosing/moving it is separate.
- **Remote / CI executor.** The eventual product form: `/drain` (and friends) run as a headless service (a
  GitHub Action / hosted runner) that acquires an ephemeral checkout, lands the `ready-to-merge` PRs, and
  disposes — zero local footprint. The self-approved `gh pr merge` transport is already headless-friendly,
  so once the root is allocator config this is a drop-in executor swap.

## Why

Productionizing the PR flow (and eventually shipping it as a product) needs a **standard shape**: the
working area cannot be a random hand-named clone in the developer's own workspace. Extracting the
"ephemeral working checkout" as one leased, use-agnostic allocator — with location as config — is what lets
the same primitive run locally, in a managed dir, or on a remote runner without any skill hardcoding a path.

## Ordering

`blockedBy #2267` — #2267 is the narrow data-loss guard: it ships the cheap dirty-or-ahead **skip** (its
recommended option (a)) that stops `refresh`/`provision` from silently `reset --hard`-ing an in-flight lane,
and it *explicitly defers* the full lease (its option (b)). #2275 is that deferred lease, generalized: a
first-class exclusive lease every flow acquires, plus the drain/merge migration and the config root. So the
floor (#2267) lands first; this builds the general primitive on top. (Filing this item hit the #2267 bug
live — a concurrent pool refresh hard-reset the authoring lane and wiped the draft twice — which is why the
guard is the prerequisite.)

## Context

Surfaced in a `/drain` + `/close` session (2026-07-04) while explaining why the drain provisions its own
clone instead of a pool lane. User's reframe: "lanes do not have to be for a specific use — can be for
anything, including merge, drain, prepare, decision — all of it." Relates to the
`no-work-ever-in-primary-all-repos` agent-memory rule (the lane-clone edit rule this generalizes),
/backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua/ + #1945 (the clone-based pool
and its reservation/lock layer this extends), and #2162 (the deferred-drain command that would consume the
new allocator).
