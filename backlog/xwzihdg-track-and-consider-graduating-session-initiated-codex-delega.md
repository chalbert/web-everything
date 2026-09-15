---
kind: decision
status: open
dateOpened: "2026-09-14"
relatedTo: ["3654"]
tags: [codex, delegation, model-routing, graduation, scorecard]
---

# Track and consider graduating session-initiated Codex delegation as a trusted capability

Tonight (2026-09-14), for the first time, an interactive orchestrating Claude Code session delegated real work directly to Codex via we:scripts/codex-direct-task.mjs, using a Codex-drafts/Claude-subagent-verifies-and-lands pattern -- because the orchestrating session's own standing rule (ask a subagent, never shell out itself) blocks it from running Codex directly. First live trial: PR #2223 (pid-forwarding fix), in progress. Idea: treat this like a real subagent type earning trust rather than an ad hoc one-off -- track trials, then consider graduating it to a named, trusted capability. See body for the two-part idea and #3654 as precedent.

## The idea

1. **Start small and deliberately track outcomes.** Reuse this repo's existing scorecard/graduation-data
   pattern -- we:scripts/conveyor/run-scorecards.json, already used for the mechanical dispatcher's own
   model-probation graduation criteria (#3654) -- to record each session-initiated Codex delegation trial:
   the task given, what Codex produced, what the verifying Claude subagent's scrutiny found (good/bad, and
   specifics), and whether it landed.
2. **Once enough trials accumulate with a clean track record, consider graduating the pattern** --
   formally recognizing session-level delegation to Codex (and eventually other models) as a trusted, named
   capability alongside Claude subagents, rather than an improvised one-off each time. This follows the same
   spirit as #3654's graduation-criteria work (bar scales with role authority, an informative-trial
   requirement, a calibration-miss veto) but applied to a different context: an interactive orchestrator
   delegating ad hoc work, not the autonomous mechanical dispatcher.

## Open questions (left for a future /prepare-decision-item pass)

This filing deliberately does not resolve:

- What counts as "enough" trials before graduation is even considered.
- What the graduation bar should be for this context (interactive session delegation), as distinct from
  #3654's bar for the mechanical dispatcher's autonomous model-probation.
- Whether tracking reuses we:scripts/conveyor/run-scorecards.json directly, or needs its own tracking file
  (that file currently lives only on branch `lane/mechanical-dispatcher`, not yet on `main`).

Per this repo's "never take an unprepared decision" rule, these are left open here and belong to whichever
future session runs `/prepare-decision-item` on this card.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
