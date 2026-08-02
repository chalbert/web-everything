---
bornAs: xefpfd2
kind: task
status: open
dateOpened: "2026-08-02"
tags: [agent-tooling, closing-session, cost, lane-guard, backlog-cli]
---

# Cost-on-card accrual is unreachable at close — the lane-only guard blocks it and the close may not open a PR

The `closing-session` skill's cost-on-card step tells the close to accrue the session's usage-equivalent cost onto
the card(s) worked. In this repo it cannot: `we:scripts/backlog.mjs cost` is blocked in the primary checkout by the
lane-only mutation guard (#2431), and the close's own hard rules forbid opening a PR for anything but memory. So the
step silently no-ops every close. Evidence: a grep for `costUsd` / `costTokens` / `costSessions` across all 2 829
backlog items returns **zero** matches — no card has ever carried a cost since the guard landed.

## Gap

Three rules are individually right and jointly unsatisfiable:

1. `we:scripts/backlog.mjs` dies with *"Every card mutation (cost/claim/resolve/…) must run in a LANE clone"* —
   `cost` is named explicitly, with no carve-out (#2431, resolved 2026-07-28; #2219/#2339 ratified that nothing ever
   splices to primary).
2. The closing-session skill's cost step calls `we:scripts/backlog.mjs cost` directly and says "the card edit folds
   into the clean auto-commit" — it has **no** lane-provisioning logic, unlike the memory path in the same skill,
   which does provision a lane and open a PR.
3. The close's hard rules say never push and never open a PR, with a single carve-out for memory.

An interactive top-level session runs from the primary checkout and delegates edits to lane clones, so path 2 is the
common case and it always hits the guard.

`we:docs/agent/platform-decisions.md` already states the intended design — "the cost-on-card splice either fold into
an already-PR'd lane commit or are session-meta under this carve-out" — but nothing implements the folding when the
closing session itself runs from primary.

## Why it matters

Cost-on-card exists so a card carries its true cumulative cost across its whole life (`/prepare` then `/decide` then
build summing into one running total), which is the input to the batch point-budget and to any cost-per-item
reasoning. Every session's figure is currently discarded, and nothing reports the omission — the close prints a
dollar total and moves on, so the gap reads as "no item worked" rather than "blocked".

## Mechanical fix

Pick one:

- **(a) Local-signal carve-out.** Treat `cost` like the sanctioned session-meta writes
  (`we:.claude/skills/batch-backlog-items/claims.json` and its class) and allow it on primary. Cheapest, and
  defensible: a cost accrual is per-session bookkeeping, not durable reviewable content. Cost: it is real frontmatter
  on a tracked file, so it weakens the "nothing splices to primary" invariant #2339 ratified — this fork needs an
  explicit call, not a quiet exception.
- **(b) Lane-route the accrual in the skill.** Give the close's cost step the same lane→PR machinery its memory step
  already has. Keeps every invariant intact; costs a PR per close for a frontmatter line.
- **(c) Defer the accrual.** Have the close write the figure to a session-meta file (already a sanctioned local
  write) and let the next lane commit that touches the card fold it in.

**(b)** is the smallest change that breaks nothing; **(a)** is the smallest change overall but reopens a ratified
invariant.

## Provenance

Found at the close of the human `/review` session on **PR #982** (2026-08-02), when the cost step was run and the
guard refused it. Red-teamed before filing: the problem is real (verified in `we:scripts/backlog.mjs` and by the
zero-match grep), not a duplicate (#2431 is the guard itself, resolved; #2779 is unrelated plateau SaaS build
metering), and actionable. Related: #2431, #2339, #2219.
