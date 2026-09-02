---
bornAs: xfhficz
kind: task
parent: "3383"
status: resolved
dateOpened: "2026-08-30"
dateStarted: "2026-09-02"
dateResolved: "2026-09-02"
graduatedTo: none
tags: []
scope:
  - we:docs/agent/
  - we:skills-src/conveyor/SKILL.md
  - we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md
---

# No operator runbook exists for running, monitoring, or recovering the mechanical dispatcher

Everything a person needs to operate this epic's dispatcher — checking liveness, stopping it safely, closing out a stuck `--bg` agent, the env vars a real dispatch needs, where the logs live — exists only as prose scattered across #3383's own session-update paragraphs and the unlanded plist-example header comment. No `we:docs/agent/*.md` file covers operating the resident supervisor+runner+lock system; `we:skills-src/conveyor/SKILL.md` is the interactive session's own operating script, not a runbook for someone who did not build it. The sibling drain daemon has its operating precedent recorded in ratified statute ([#drain-daemon-self-hosting-boundary](../docs/agent/platform-decisions.md#drain-daemon-self-hosting-boundary)); this dispatcher has no equivalent stable reference.

**Landing-order note:** part of what this runbook would document — the supervisor's own liveness/stop behavior — lives in we:skills-src/conveyor/supervisor.mjs, which does not exist on `main` yet (only on `origin/lane/mechanical-dispatcher`). The already-landed pieces (`we:scripts/operations/wake.mjs`, `WE_DISPATCH_AGENT_ARGS`, the JSONL log locations already in real use) can be documented now regardless; the supervisor-specific sections should wait for or track that branch's landing status via #3383.

## Done when

1. A `we:docs/agent/*.md` runbook exists (or a section of an existing operations doc) covering: how to tell if the supervisor/runner is alive, how to stop it safely, how to close out a stuck dispatch, the required env vars before a real dispatch, and where its logs live — sourced from the operational knowledge already recorded across #3383's session updates, not re-derived from scratch.
2. The runbook is discoverable without reading #3383's full history — linked from wherever a future operator would naturally land (we:skills-src/conveyor/SKILL.md, or the epic itself).

## Progress

- **Done:** Wrote `we:docs/agent/dispatcher-runbook.md` — liveness (the runner's singleton-lease read), safe
  stop (runner vs. dispatched agent), closing out a stuck `--bg` agent (`claude stop`, never `kill`, plus
  `we:scripts/operations/dispatch-abort.mjs`'s stop-then-close-out and `--trust` composition), the `WE_DISPATCH_AGENT_ARGS`/
  `--permission-mode dontAsk` requirement, and the state/log-location table. All sourced from #3383's own
  session-update history, not re-derived.
- **Landing-order honored:** `we:skills-src/conveyor/supervisor.mjs` is still branch-only (confirmed absent on
  `main` at build time) — the runbook covers only what's landed and flags the supervisor gap explicitly for
  whoever adds that section once #3443's graduation lands it.
- **Linked from** `we:skills-src/conveyor/SKILL.md` §2 (Start the runner), the natural landing spot for an
  operator running the dispatcher.
