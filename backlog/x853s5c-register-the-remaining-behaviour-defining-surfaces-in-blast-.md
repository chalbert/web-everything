---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs", "we:scripts/lib/review-policy.contract.json"]
---

# Register the remaining behaviour-defining surfaces in BLAST_RADIUS — we:.claude/settings.json, we:.claude/commands/, we:AGENTS.md, non-statute we:docs/agent/

`BLAST_RADIUS` in [`we:scripts/lib/review-escalation.mjs`](scripts/lib/review-escalation.mjs) now covers the two agent-behaviour *trees* (skills + agent memory, both spellings — #2909), but four surfaces that define agent behaviour just as directly still score **nothing**: `we:.claude/settings.json`, `we:.claude/commands/`, `we:AGENTS.md`, and non-statute `we:docs/agent/`. Verified at #2909's head: `isBlastRadiusPath` returns `false` for all four. Named as "not addressed" in PR #1048's body; filed here so the obligation stops living in prose.

## The gap

| Path | `isBlastRadiusPath` | What it actually controls |
|---|---|---|
| `we:.claude/settings.json` | `false` | **Registers the `PreToolUse(Edit\|Write)` write-gate hooks.** Deleting one hook entry turns the write-time guard off for every later session. |
| `we:.claude/commands/` | `false` | The slash-command router — `/drain`, `/pr`, `/resolve`, `/workflow`. Repointing one re-routes the transport. |
| `we:AGENTS.md` | `false` | The Tier-0 router every session loads first. |
| non-statute `we:docs/agent/` | `false` | The Tier-1 references `we:AGENTS.md` routes into (only `we:docs/agent/platform-decisions.md` and the `statute` patterns are covered, via `STATUTE_PATHS`). |

## Why it matters

Same shape as the #1040 / #1043 / #1045 regression #2909 fixed, one surface over. A ~4-line agent-authored PR deleting a hook entry from `we:.claude/settings.json` fires no rubric signal, so `producerReviewLabel` returns `null`, no `review:*` label is applied, and it merges with no reviewer — turning off the guard that the *next* session's edits rely on. These files are exactly what blast-radius exists to catch: they change how the system behaves, not what it renders.

## The open call — scope, not whether

The `we:.claude/` half is one alternative on the existing anchor. The `we:docs/agent/` half is the real design question: registering that whole tree would escalate every prose touch-up in a large, frequently-edited directory (over-escalation is the safe direction by policy, but it is not free — every escalation parks a PR awaiting a review). Options to weigh:

- register `we:.claude/settings.json` + `we:.claude/commands/` + `we:AGENTS.md` only, and leave `we:docs/agent/` to the statute patterns it already has;
- register all four, accepting the `we:docs/agent/` volume;
- register `we:docs/agent/` behind a narrower predicate (the router files, not every reference).

## Done when

- Each of the four surfaces either scores blast-radius or carries a written reason in
  [`we:scripts/lib/review-escalation.mjs`](scripts/lib/review-escalation.mjs) for why it deliberately does not.
- Positive **and** negative cases in [`we:scripts/lib/__tests__/review-escalation.test.mjs`](scripts/lib/__tests__/review-escalation.test.mjs) pin whatever line is drawn.
- The `blast-radius` token description in [`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json) enumerates the resulting surface set (the #2564/#2566 rule: the contract's per-entry prose *is* its meaning).
