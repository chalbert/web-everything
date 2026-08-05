---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs", "we:scripts/lib/review-policy.contract.json"]
---

# Register the remaining behaviour-defining surfaces in BLAST_RADIUS — or invert the .claude/ anchor to default-deny

`BLAST_RADIUS` in [`we:scripts/lib/review-escalation.mjs`](scripts/lib/review-escalation.mjs) now covers the two agent-behaviour *trees* (skills + agent memory, both spellings — #2909), but every other surface that defines agent behaviour just as directly still scores **nothing**: `we:.claude/settings.json`, `we:.claude/commands/`, `we:AGENTS.md`, `we:CLAUDE.md`, non-statute `we:docs/agent/`, and — prospectively — `we:.claude/agents/` and `we:.mcp.json`. Verified at #2909's head: `isBlastRadiusPath` returns `false` for all of them. Named as "not addressed" in PR #1048's body; filed here so the obligation stops living in prose.

## The gap

| Path | `isBlastRadiusPath` | What it actually controls |
|---|---|---|
| `we:.claude/settings.json` | `false` | **Registers the `PreToolUse(Edit\|Write)` write-gate hooks.** Deleting one hook entry turns the write-time guard off for every later session. |
| `we:.claude/commands/` | `false` | The slash-command router — `/drain`, `/pr`, `/resolve`, `/workflow`. Repointing one re-routes the transport. |
| `we:AGENTS.md` | `false` | The Tier-0 router every session loads first. |
| `we:CLAUDE.md` | `false` | The auto-loaded stub that points every Claude session at `we:AGENTS.md`. Repointing it re-routes Tier-0 itself. |
| non-statute `we:docs/agent/` | `false` | The Tier-1 references `we:AGENTS.md` routes into (only `we:docs/agent/platform-decisions.md` and the `statute` patterns are covered, via `STATUTE_PATHS`). |
| `we:.claude/agents/` | `false` | **Prospective** — not tracked in WE today. Subagent definitions: model, tools, and the instructions a delegated agent runs under. |
| `we:.mcp.json` | `false` | **Prospective** — not tracked in WE today. Registers MCP servers, i.e. which external tools every session may call. |

The last two are listed as prospective on purpose: they are exactly the surfaces that would appear *later* and score nothing on day one, which is the failure mode below.

## Why it matters

Same shape as the #1040 / #1043 / #1045 regression #2909 fixed, one surface over. A ~4-line agent-authored PR deleting a hook entry from `we:.claude/settings.json` fires no rubric signal, so `producerReviewLabel` returns `null`, no `review:*` label is applied, and it merges with no reviewer — turning off the guard that the *next* session's edits rely on. These files are exactly what blast-radius exists to catch: they change how the system behaves, not what it renders.

## The open call — enumerate wider, or invert to default-deny

Every recurrence of this class (#1040/#1043/#1045 → #2909 → this item) was closed **one surface at a time**, because a named-path list is correct only while someone remembers to register each *future* surface. That memory is precisely what the prior regressions proved unreliable, so "add these seven paths" is the weakest of the options here, not the obvious one.

- **Enumerate wider** — register the named paths above and keep the list a list. Cheapest; fails OPEN again the next time a behaviour-defining file appears under a name nobody predicted.
- **Invert to default-deny (preferred candidate)** — anchor `(^|\/)\.claude\/` *whole* as blast-radius, with a short commented EXEMPTION list for the genuinely inert entries. An unregistered surface then fails **CLOSED** the day it appears: a new `we:.claude/agents/` or a new hook file escalates without anyone having filed anything. The cost is over-escalation on the exempt-but-unlisted tail, which is the safe direction by policy. Note this only covers `we:.claude/` — `we:AGENTS.md`, `we:CLAUDE.md` and `we:docs/agent/` still need their own call.
- **Register `we:docs/agent/` behind a narrower predicate** (the router files, not every reference) — the one genuinely volume-sensitive half: registering the whole tree escalates every prose touch-up in a large, frequently-edited directory, and every escalation parks a PR awaiting a review.

Weigh the inversion as a real option, not as a footnote — it is the only one of the three whose correctness does not depend on a future editor remembering this item exists.

## Done when

- The `we:.claude/` anchor is settled one way or the other: either inverted to default-deny with a written exemption list, or each named surface above scores blast-radius / carries a written reason in
  [`we:scripts/lib/review-escalation.mjs`](scripts/lib/review-escalation.mjs) for why it deliberately does not.
- Positive **and** negative cases in [`we:scripts/lib/__tests__/review-escalation.test.mjs`](scripts/lib/__tests__/review-escalation.test.mjs) pin whatever line is drawn — including a case for a surface that does **not** exist yet, so the fail-open-on-a-new-name behaviour is pinned rather than assumed.
- The `blast-radius` token description in [`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json) is re-derived from the **whole** `BLAST_RADIUS` array — every entry, including `...STATUTE_PATHS` and the engine-tier basenames, not only the surfaces this item adds (the #2564/#2566 rule: the contract's per-entry prose *is* its meaning, so a partial enumeration is drift by construction).
