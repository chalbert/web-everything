---
bornAs: xkfzukn
kind: story
size: 5
priority: high
status: open
scope: ["we:scripts/backlog.mjs", "we:scripts/lib/build-queue.mjs", "we:scripts/conveyor/queue-store.mjs", "we:scripts/conveyor/queue.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Build-queue ordering: read the real cleared queue, and let priority count

`we:scripts/backlog.mjs build-queue --json` still reads the old in-checkout `we:.conveyor/queue.json` instead of the state-home location PR #2816 moved the queue to, so it reports `cleared: 0` from every checkout even when work is genuinely cleared — a live probe from `~/workspace/wev-control` shows `build-queue --json` at `cleared: 0` while `node we:scripts/conveyor/queue.mjs list` (which does resolve through the state home) reports 77 cleared items in the same tree at the same moment. That makes the build queue's own headline "how much is ready to build" number silently wrong on every checkout, and it is the same class of bug already fixed for `/wip` on the plateau side (card xykd1x3) — the fix here is the same shape: read `buildQueued`/cleared state through `we:scripts/conveyor/queue-store.mjs`'s state-home resolver instead of a hardcoded in-checkout path.

Separately, and compounding it: the ordering itself never looks at `priority`. `we:scripts/lib/build-queue.mjs`'s `orderQueueDetailed` sorts strictly `tier → effectiveScore (desc) → rank (asc) → dateOpened (asc) → num (asc)`, and `DEFAULT_CONFIG.criteria` is only `value` / `timeCriticality` / `unblocks` (`we:scripts/lib/build-queue.mjs:33-36`) — `priority: high` frontmatter (`we:scripts/backlog.mjs`'s own `prioritize` verb writes it) is never read anywhere in the scoring or sort. Concretely: #4348/#4352/#4353 were all filed today as `priority: high` blockers, but before this session hand-pinned them via `tier`/`rank` they sat in the `normal` tier behind 9 older ordinary cards purely on WSJF score — the frontmatter said "high priority" and the queue ignored it completely.

**Recommended default: make `priority: high` count as an in-tier boost (or, cheaper, auto-pin any card the priority verb marks high) rather than requiring a human to hand-run `tier`/`rank` every time, and fix the read path to the real state home first** — the read-path bug is the more urgent of the two since it makes the queue's `cleared` count actively lie on every checkout, not just mis-order within the truth. As a secondary, low-cost win: have the builder's `--dry-run` print the full pick order with the reason for each position (which criterion/tier/rank decided it), so a human auditing "why is X above Y" doesn't have to re-derive `orderQueueDetailed` by hand — this session had to read `we:scripts/lib/build-queue.mjs` source directly to explain the current order.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
