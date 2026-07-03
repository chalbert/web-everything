---
kind: story
size: 3
parent: "2193"
status: resolved
dateOpened: "2026-07-03"
dateResolved: "2026-07-03"
tags: [lane, session-tooling, drain, backlog, git]
---

# Backlog reads fetch-first and guard against a stale local `main`

The landing scripts (`we:scripts/lane-drain.mjs`, `we:scripts/merge-ai-prs.mjs`, `we:scripts/lane-pool.mjs`)
`git fetch` before they act, but the **read** side does not: `we:scripts/check-readiness.mjs` (the ranker
behind `/batch`, `/next`, `/ready`) and the backlog data loaders read the local `we:backlog/` tree with **no
fetch**. So when the local checkout is behind `origin/main` — seen 2026-07-03 at **126 commits behind** — the
ranker picks and orders against **wrong item state**: items look missing, resolved items look open, and freshly
filed ids look **clobbered/colliding** (the whole confusion that opened the 2026-07-03 hardening session).

**Fix — a fetch-first preflight + staleness guard at the one chokepoint the readers share.** Before ranking:
best-effort `git fetch origin main` (fast, non-destructive; degrade **silently** offline — never hard-fail a
read on a network miss). Then compare local `main` to `origin/main`:

- clean working tree + behind → **auto fast-forward** (`git pull --ff-only --autostash`), or
- dirty / diverged → **loud warning** at the top of the output (`local main is N commits behind origin/main —
  ranking may be stale; sync or work in a fresh clone`), and prefer authoritative state from `origin/main`
  where cheap.

Reuse the existing fetch pattern from the landers. This is the general "any skill looking at `main` fetches
first" rule enforced once, not sprinkled per-skill. Relates to #2197 (clean-clone model) and the
`stale-primary-clobbers-backlog-ids` memory.
