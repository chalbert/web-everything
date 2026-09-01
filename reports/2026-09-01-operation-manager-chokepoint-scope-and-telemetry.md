# The operation manager — how much is already ratified, what's actually still open

**Date**: 2026-09-01
**Point**: Preparing decision #3427 found three of its four framing bullets already ratified/reasoned in shipped code (#3031, #3405, #3421/#3422, `we:scripts/operations/http-adapter.mjs`'s own header) — the remaining, genuinely open ground is two narrow forks: the catalog's candidacy-scope boundary, and whether cheap/read-only calls should carry a lightweight telemetry signal distinct from the deliberately-skipped run record.
**Plan file**: n/a (conveyor prepare dispatch, not a `plans/` inbox item)
**Research page**: `/research/operation-manager-chokepoint-scope-and-telemetry/`

---

## Question

#3427 captures a 2026-08-31 operator discussion under the framing "a real execution chokepoint every command
routes through," with four properties: semantically-named operations; logged/telemetered even for cheap
calls; tiered by cost (three tiers); a catalog that grows from real usage. The card explicitly says none of
this is settled and defers to whoever picks it up next. Preparing it means first checking how much already
*is* settled by code and statute shipped since epic #3029 began (before this card was even opened), so the
decision turn spends judgment only on what's genuinely still open.

## Recommendation

Prepare #3427 as two forks, both forced-invariant shaped (one branch coherent, one excluded on stated
grounds already in the tree), rather than the four-bullet open list the card currently carries:

- **Fork 1 (scope)** — keep the catalog's candidacy scope at "delivery-loop operations" (#3031's literal,
  ratified text), growing organically via the already-ratified missing-operation mechanism (#3405/#3421/#3422)
  — not "every command in the repo" read literally, which would mean forcing `git status`/`ls`/one-off
  inspection commands through declarations for no consumer.
- **Fork 2 (telemetry mechanism)** — a lightweight, purpose-built call-visibility signal (access-log shaped,
  cheap, prunable) for every operation call regardless of step kind, kept structurally separate from the
  run-record store — never persisting a full run record for `compute`-only calls, which would relitigate
  `we:scripts/operations/http-adapter.mjs`'s own stated "a record per page-load is landfill" reasoning without new grounds to do so.

Everything else in the card's four bullets is settled ground, cited rather than re-decided, with an explicit
non-overlap note against sibling items #3188 (session restriction, still open, different population) and
#3398 (supervisor-process liveness alerting, narrower target, already filed as a story).

## Key Findings

- `we:scripts/operations/` already implements almost the whole "operation manager" the card describes: a pure
  engine (`we:scripts/operations/engine.mjs`), a closed declaration shape (`we:scripts/operations/registry.mjs`'s `op()`), two derived adapters
  (`we:scripts/operations/cli-adapter.mjs`, `we:scripts/operations/http-adapter.mjs`), and ~15 registered operations — this is not greenfield design, it's
  an existing system the card's own text doesn't cite.
- `we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated` (#3031, ratified 2026-08-08)
  already closes "semantically-named, no raw-command leakage" (clause 1) and the step-kind vocabulary (clause
  2) plus the two-tier backend (clause 4) — directly answering the card's "semantically-named operations" and
  "tiered by cost" bullets.
- `#dispatched-agent-never-runs-commands-directly` (#3405, ratified 2026-08-30) plus #3421/#3422 (ratified
  2026-08-31, the same session #3427 itself cites) already close "the catalog grows from real usage" with a
  concrete built mechanism (confidence-assessment self-clear/batch/blacklist through the learnings-pool/
  `/harvest` pipeline) — directly answering the card's fourth bullet.
- `we:scripts/operations/http-adapter.mjs`'s own header explicitly reasons through, and rejects, persisting a run
  record for `compute`-only (cheap/read-only) operation calls ("a record per page-load is landfill") — so the
  card's "logged even for cheap calls" bullet is not a design gap nobody looked at; it's a design choice
  already made, for a stated reason, that the card's own request would reopen without new grounds unless
  reframed around a *separate* lightweight mechanism.
- At least four shipped operations (`gate-health`, `suggest-next`, `verify`, `pr-status`) are all-`compute` and
  today produce zero trace of being called — confirming the gap is real, just narrower than "every command"
  (it's specifically the read-only/compute-only surface).
- #3188 (still open) already owns "should an agent session be restricted to declared-operations-only" — a
  prompt-injection blast-radius question for the interactive/session population, not #3427's population —
  and must not be re-decided here. #3398 (filed story) already owns supervisor/runner-process liveness
  alerting specifically, narrower than #3427's per-call visibility ask.

## Files Created/Modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics/operation-manager-chokepoint-scope-and-telemetry.json` | Created |
| `we:src/_includes/research-descriptions/operation-manager-chokepoint-scope-and-telemetry.njk` | Created |
| `we:reports/2026-09-01-operation-manager-chokepoint-scope-and-telemetry.md` | Created (this file) |
| `we:backlog/3427-design-an-operation-manager-a-real-execution-chokepoint-ever.md` | Rewritten to prepared-fork shape, `preparedDate` stamped |
