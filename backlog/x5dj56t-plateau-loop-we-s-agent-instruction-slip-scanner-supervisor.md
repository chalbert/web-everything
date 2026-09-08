---
kind: story
size: 3
parent: "2445"
status: open
blockedBy: ["3592", "3593", "3594"]
dateOpened: "2026-09-07"
tags: [plateau-loop, agent-supervision, reliability, constellation-placement]
---

# Plateau Loop: WE's agent instruction-slip scanner/supervisor generalizes the coordinator's own 'supervised children' reliability property

we:backlog/2445's own framing is that the coordinator 'spawns agents as supervised children,' but none of its ~40 existing children catch a spawned agent's own mid-turn misbehavior (a false monitor-wait claim, a bespoke prompt bypassing a declared operation) the way we:backlog/3593/3594/3592 build for WE's own dispatcher tonight. A different 'supervisor' concept than we:backlog/2468 (process crash-recovery). A resident coordinator that can't rely on an operator manually reading every child's transcript needs exactly this standing compliance supervision. Tracks generalizing it; does not rebuild the WE-side scanner/supervisor.

## Grounding — checked against we:backlog/2445's actual text and its ~40 children, not assumed

- **we:backlog/2445's own opening framing**: "one process owns the state machine... and spawns agents as supervised children." The word "supervised" is load-bearing but never decomposed anywhere in the epic's own text into what supervising a child agent's *behavior* (as opposed to its process liveness) actually means.
- **Checked the existing children for overlap — none found.** we:backlog/2468 ("Plateau Loop: supervisor — crash recovery, persisted state, self-update-then-reload") is the only child using the word "supervisor," and its scope is entirely about the *supervisor process's own* residency (crash recovery across sleep/reboot, self-hosting) — nothing about detecting a spawned *child* agent's false claims or bespoke-prompt bypasses. we:backlog/2445's closed-world model section ("Review happens in-lane... a human is asked ONLY on genuine agent disagreement (deadlock)") describes verdict reconciliation, not behavioral compliance monitoring. This is genuinely new ground, not a rediscovery.
- **The reliability case is sharper for a product than for WE's own internal use.** WE's own version of this problem was caught "only because the operator manually read each subagent's transcript... This does not scale and depends entirely on a human noticing by chance" (we:backlog/3593's own words). A coordinator product managing agents across a multi-project registry for other operators cannot assume *any* human is reading transcripts by hand — the failure mode we:backlog/3593 exists to close is structurally worse, not better, once this becomes a product other people run.

## What's actually being generalized

- **we:backlog/3593** (epic) — splits the problem into a syntactically-checkable half (regex/pattern-detectable against a transcript) and a judgment half (whether a hand-composed prompt should have used a declared operation).
- **we:backlog/3594** — Stage 1: a report-only, fleet-wide scanner for false monitor-wait claims, reusing we:skills-src/inspect-agent-health/agent-health.mjs's bounded-tail-read safety property and we:scripts/dev/active-progress-watch.mjs's filesystem-based fleet enumeration.
- **we:backlog/3592** (decision) — how a Stage 2 standing judgment-supervisor actually gets invoked and kept running (dispatched-on-schedule vs. a persistent process vs. a scheduled recurring dispatch); not yet ratified.

## Not in scope

- Rebuilding, rescoping, or re-deciding any of the WE-side items above.
- Assuming the Loop's own supervision mechanism reuses WE's *transcript format* specifically — a coordinator spawning a non-Claude provider (see we:backlog/xhg3r91) would need an equivalent, provider-neutral behavioral-compliance signal, which this item's own eventual scope should address rather than assume away.
- Any plateau-app-side filing or `locus:` field, per we:docs/agent/platform-decisions.md#backlog-tracking-locus-now-distributed-next.

## Cross-references added

- we:backlog/3593 — now carries a short pointer to this item.

## Done when

1. **Executable** — TODO: once we:backlog/3594's Stage 1 scanner has run for real and we:backlog/3592's invocation-shape decision is ratified, this item is `/prepare`d into a concrete plateau-app build scope (what the Loop's own child-agent compliance signal looks like, and whether it can stay provider-neutral) rather than left as a placeholder.
