---
kind: story
size: 3
status: open
blockedBy: ["3559"]
relatedTo: ["3559", "3001"]
scope: ["we:scripts/capability-search.mjs", "we:scripts/lib/capability-search-usage.mjs", "we:scripts/audit-backlog-health.mjs", "we:scripts/__tests__/capability-search-usage.test.mjs"]
dateOpened: "2026-09-07"
tags: [telemetry, decision-revisit, agent-habit, operations, backlog]
---

# Mechanically log capability-search usage and trigger a revisit of #3559's mandatory-vs-optional fork

[#3559](/backlog/3559-search-operations-skills-and-the-backlog-before-proposing-or/) proposed a
`capability-search` skill and, in its body, deliberately deferred a fork: should the skill stay
**(a) invoked at a session's own discretion**, or be **(b) also wired as a referenced step** other
build-dispatch briefs are expected to follow (e.g. `we:skills-src/conveyor/delivery-agent-brief.md`)? #3559's
own read: decide that once the skill "has real invocations to point at ... deciding that now would be
picking a gate's shape before there's evidence it's needed."

**Correction to the premise this item was requested under: #3559 has not actually shipped the skill.**
Its merged PR (#1984) filed only the backlog card itself (`we:backlog/3559-*.md`, `status: open`) — there is
no `we:scripts/capability-search.mjs`, no `we:scripts/__tests__/capability-search.test.mjs`, and no
`we:skills-src/capability-search/SKILL.md` on `main` as of 2026-09-07. So there is nothing to instrument yet
and no usage to have evidence about. **This item is therefore `blockedBy: 3559`, not merely `relatedTo`** —
its logging code has nothing to call into until #3559's own build lands.

A deferred fork with no forcing function tends to sit forever — nobody schedules "go check if capability-
search actually got used." Per [#3001](/backlog/3001-should-agents-call-named-operations-instead-of-writing-shell/)'s
deterministic-core/thin-judgment split and the standing rule "script-decidable → hook, judgment stays in
context," the fix is a small mechanical loop: **log every real invocation, then let a deterministic check —
not a person's memory — notice when there's enough evidence to re-open the fork.**

## No existing "postponed pending evidence" mechanism found — this establishes the pattern, reusing existing plumbing

Searched `we:backlog/*.md`, `we:docs/agent/*.md`, and `we:skills-src/*/SKILL.md` for "revisit", "usage
evidence", "telemetry", and "adoption metric" (2026-09-07): every hit is a **one-off revisit trigger written
in a single ratified decision's own prose** (e.g. #057, #082, #1103) — there is no reusable *mechanism* that
logs usage and mechanically re-opens a deferred call. Two existing conventions get reused here rather than a
new one invented:

1. **The event store — the learnings-drop-box pool shape.**
   `we:scripts/conveyor/learnings-drop.mjs` already solves "durable, cross-checkout, append-only event log":
   a machine-fixed pool outside any working copy (`$LEARNINGS_POOL || ~/.claude/conveyor/learnings`,
   `<pool>/<session>.jsonl`) so a lane clone and the primary checkout append to the *same* pool, plus a
   best-effort, schema-capped, never-throws append (mirrors `defaultAppendLog` in
   `we:scripts/conveyor/branch-sync.mjs` too). `we:scripts/lib/capability-search-usage.mjs` copies that exact
   shape for a new pool: `$CAPABILITY_SEARCH_USAGE_POOL || ~/.claude/conveyor/capability-search-usage`,
   `<pool>/<session>.jsonl`. One line per invocation of `we:scripts/capability-search.mjs`:
   `{ts, session, query (capped ~200 chars), verdict: "exact"|"partial"|"none", hitCount}`. The append is
   best-effort and non-blocking — a logging failure must never break a search.
2. **The surfacing mechanism — check:health's existing decision-health flags, not a new channel.**
   `we:scripts/audit-backlog-health.mjs` already runs a **G-series** of deterministic, already-watched flags
   over `kind: decision` items (G1 edge-gaps, G4/G5 prepared-decision shape checks, G6 missing `codifiedIn`,
   G8 unruled-sibling leans). This is exactly "flag a decision-shaped thing that needs attention," already
   wired into a report the operator already watches — reuse it instead of inventing a notification channel.
   Add one more flag (numbered whatever's next when this is built) that reads the usage pool and fires once
   the revisit trigger (below) is met.
3. **The ratification surface — carve the fork to its own `kind: decision` item, per the existing carve rule.**
   `we:docs/agent/backlog-workflow.md` ("*A fork lives in a `kind: decision` item — never inline in an
   idea/epic/story body*") already states that a fork embedded in a non-decision item's body should be
   *carved* to its own decision item once it's real work, not resolved in place. #3559's mandatory-vs-optional
   fork is exactly that case. So: carve it to a new `kind: decision` item now (as part of building this
   story), authored in the **validation-gate shape** `we:docs/agent/backlog-workflow.md` already defines for
   "do we commit to X, and on what trigger?" calls (verdict = **not-yet**, trigger = the mechanical condition
   below, a `Skeptic:` line) — then the new health flag just **points at that already-filed decision item**
   rather than auto-filing a fresh one when the trigger fires. Trim #3559's own "Open question" section to a
   one-line pointer at the carved item, same as any other carve.

## The revisit trigger — recommended default, not ratified here

**Not confidently defaultable — flagging for the operator, per the same "state a default, don't silently
pick it" shape #3559 itself used for its own fork.** My recommendation: fire once **any one** of —

- **N = 15** logged invocations accumulate in the pool, OR
- **M = 2 months** elapse since #3559's own ship date, OR
- **≥ 1 near-miss** is logged — a session marks an invocation `nearMiss: true` when a hit it returned would
  have prevented a duplicate build had the session not already been about to check by habit (this is a
  judgment call the script cannot make, same deterministic-core/thin-judgment split #3001 draws for the
  search's own match verdicts — logged by the calling session, not inferred).

whichever comes first. Reasoning for the bold default: 15 invocations is enough to distinguish "used a
handful of times by the one habitual session" from "actually adopted"; 2 months bounds the wait even if
adoption is slow; a single near-miss is itself the strongest possible signal (a caught duplicate-build is
exactly the harm #3559 exists to prevent) so it shouldn't need to accumulate. **Not ratified — the operator
should confirm or override N/M before this ships**, the same way #3559's own fork stayed open pending real
evidence.

## Done when

1. **Executable** — running `node we:scripts/capability-search.mjs "<query>"` (once #3559 lands) appends one
   event to the usage pool (verifiable by pointing `$CAPABILITY_SEARCH_USAGE_POOL` at a temp dir in a test),
   and a failure to append never causes the search itself to fail or exit non-zero.
2. **Executable** — `we:scripts/audit-backlog-health.mjs` (or its own test) reports the new flag once the
   pool's accumulated invocation count / elapsed time crosses the ratified threshold, and stays silent below
   it — a regression fixture pins both the below-threshold silent case and the at/above-threshold flagged
   case.
3. **Observable** — the mandatory-vs-optional fork is carved out of #3559's body into its own `kind: decision`
   item in the validation-gate shape (verdict, concrete trigger, `Skeptic:` line), and the new health flag's
   message names that item's id so the operator lands directly on it.
