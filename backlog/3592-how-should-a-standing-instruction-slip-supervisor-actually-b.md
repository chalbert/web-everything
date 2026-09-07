---
bornAs: xoc31xs
kind: decision
parent: "3593"
status: open
dateOpened: "2026-09-07"
tags: []
---

# How should a standing instruction-slip supervisor actually be invoked and kept running - dispatched-on-schedule, a persistent process, or something else

Real fork under we:backlog/3593-catch-and-correct-agent-instruction-slips-mechanically-a-syn.md, carved out per this repo's own epic/decision split rule rather than left inline in the epic body. Once we:backlog/3594-stage-1-fleet-wide-scanner-for-false-monitor-wait-claims-acr.md (Stage 1's report-only scanner) exists and has real flagged-agent output to point at, this decides how a Stage 2 standing supervisor - the piece that actually acts on the judgment half of the split (whether a hand-composed prompt should have used a declared operation, whether an action was redundant because a mechanical pass already handles it) - actually gets invoked and kept running across a session.

Option A: a session the operator/main-session dispatches manually each time, formalized into a reusable skill. This is today's ad hoc pattern (tonight's supervisor was dispatched via a hand-composed Agent() prompt, not a declared, reusable mechanism) just turned into a proper skill with a generic brief, per the epic's own doctrine that dispatch should never run on a bespoke prompt. Cheap to ship, no new resident-process capability needed, but has a real limit: a dispatched session has a context and lifetime limit and needs re-dispatching, so between dispatches there is no supervisor watching at all - the exact gap that let tonight's dozens of catches depend entirely on the operator noticing.

Option B: a genuinely persistent background process, analogous to we:skills-src/conveyor/supervisor.mjs (the conveyor's own resident restart/backoff/alerting wrapper around its tick runner). This would run continuously, polling the fleet-enumeration scanner (Stage 1) on its own cadence and applying judgment to what it finds. Bigger commitment: it mirrors the conveyor supervisor's own operational overhead (a spawn/backoff/alerting loop, a lease or singleton guard, a log/alert-state file, launchd-style keep-alive) for a genuinely new resident process, and per we:backlog/2881-subagent-stall-harness-backstop-detect-auto-clear-a-stuck-ba.md's own scoping judgment (a sibling case, still open), harness-level control over live subagents "leans on agent-runtime capability largely out of in-repo scope" - it is not yet clear a resident process outside the harness can reliably observe or correct another live agent's turn, versus only reading its transcript after the fact (which Stage 1's report-only scan already does fine).

Option C: something else - e.g. a scheduled recurring dispatch (the /loop or /schedule mechanism already in this environment) that runs Stage 1's scanner and only escalates to a full judgment pass when something is actually flagged, splitting "cheap periodic check" from "expensive judgment session" rather than running one continuous process or one long-lived dispatched session.

Recommended default: start with Option A (a formalized, reusable dispatched-session skill), with Option C's cheap-periodic-check idea folded in as how it gets triggered (a scheduled recurring dispatch rather than the operator remembering to invoke it) - this needs no new resident-process capability, matches how tonight's actual supervisor was run, and avoids committing to Option B's operational overhead before there is any evidence a report-only scanner plus periodic judgment passes are insufficient. Option B should be revisited only if Stage 1 data shows instruction-slips recur faster than a periodic dispatch cadence can catch them. Not yet prepared to Definition-of-Ready (no dedicated /research/ topic, no Skeptic/Screen pass) - needs a /prepare pass once Stage 1's scanner has run for real and produced actual flagged-agent evidence to ground the choice in, rather than projection.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
