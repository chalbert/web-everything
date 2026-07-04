---
kind: story
size: 3
status: open
dateOpened: "2026-07-04"
relatedTo: ["2219", "1933", "2139"]
tags: [lane-pool, infra, data-loss, footgun]
---

# Lane-pool refresh/provision must not hard-reset a dirty-or-ahead lane (data-loss guard)

`refreshLane()` does an **unconditional** `git reset --hard origin/<branch>` + `git clean -fd` on every
lane (`we:scripts/lane-pool.mjs:276-280`), with no check for whether the lane is dirty, ahead of origin,
or actively owned by a session. `refresh` applies it to *every* existing lane
(`we:scripts/lane-pool.mjs:327-339`); `provision --count=N` to lanes 1..N
(`we:scripts/lane-pool.mjs:310-325`). So **any** session that runs `refresh`/`provision` (a concurrent
`/batch`, `/workflow`, `/drain`, or another `/prepare`) silently destroys **every other session's
in-flight lane work** — both uncommitted edits *and* locally-committed-but-unpushed commits (`reset
--hard` moves the lane back to `origin/main`, dropping local commits; `clean -fd` removes untracked
files like a freshly-authored `/research/` topic or report).

There is **no ownership mechanism today.** The `map` / `we:.claude/lane-ports.json` registry is purely a
URL-proxy page-port mapping (#2139) — refresh actively *deletes* mappings (`unmapLanes`,
`we:scripts/lane-pool.mjs:331`), so it is the opposite of a lock. No heartbeat, no lease, no
skip-if-busy.

## Why this exists (evidence)

Hit live during `/prepare all` (the #2249/#2250 branding prep, 2026-07-04): a concurrent
pool-refreshing session hard-reset lane-20 **twice** mid-authoring, wiping the report + `/research/`
topic + both item bodies. The work was only saved by re-authoring in a fresh lane and **pushing to
origin fast** — committing locally is *not* sufficient protection, because a concurrent `reset --hard`
discards local commits too. The only durable state a lane offers is what has already been pushed to
`origin` (i.e. landed via `pr-land`).

## What to build

Add a **dirty-or-ahead guard** to `refreshLane()` so a reset never silently eats work:

- **(a) skip clean-check [recommended default]** — before resetting, compute the lane's porcelain state
  + ahead-count vs `origin/<branch>`; if the lane is **dirty OR ahead**, *skip* it (do not reset/clean),
  emit a visible `SKIPPED (dirty/ahead — N uncommitted, M ahead)` line, and continue with the other
  lanes. Provision still *creates* missing lanes; it just won't nuke a working one. A `--force` flag
  restores the current unconditional behavior for the deliberate "reset everything" case.
- **(b) lease/heartbeat** — a lane writes a `.git/.lane-lease` touch-file (session id + mtime) while a
  session holds it; refresh skips a lane whose lease is fresh (< TTL). Heavier; composes with the #2219
  prepare-hold local token (which already means to hard-exclude an item's lane from concurrent claim —
  wire the *same* token into `refreshLane`'s skip test so it is one ownership signal, not two).

Default to (a) (cheap, no new state, closes the data-loss hole immediately) and fold (b) in only if the
#2219 token work (its build arm) lands a lease shape worth honoring. Either way: **a lane reset must be
opt-in over in-flight work, never the silent default.**

## Acceptance

- `refresh` / `provision` leave a dirty-or-ahead lane untouched and report the skip; a clean,
  up-to-date lane still refreshes.
- `--force` (or equivalent) still allows an intentional full-pool reset.
- A concurrent session running `provision`/`refresh` can no longer destroy another lane's uncommitted or
  unpushed-committed work.
- Doc note in the lane-pool header comment (`we:scripts/lane-pool.mjs:3-26`) that a lane is safe scratch
  only for clean/ahead-skipped work, and that the durable state is the pushed `lane/*` ref.

## Notes

- Relates to #1933 (the clone-based lane pool this guards), #2139 (the lane-ports mapping that is *not* a
  lock), and #2219 (the prepare-hold local token — the natural home for a shared ownership signal).
- Scope is `we:scripts/lane-pool.mjs` only; no standard/protocol/intent surface. This is dev-infra
  (locus is the tooling, not a WE standard artifact).
