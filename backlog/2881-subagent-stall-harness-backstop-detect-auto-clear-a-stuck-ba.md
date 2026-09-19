---
bornAs: xw2ivof
kind: story
size: 3
parent: "2612"
status: open
dateOpened: "2026-08-02"
tags: []
crossRef: { url: /backlog/3684-narrow-the-human-authorize-gate-in-clear-stuck-session-for-o/, label: "related — 3684 narrows clear-stuck-session.mjs's human gate for one exact dead-session signature; this item is the general stuck background-wait subagent detect/auto-clear backstop (broader scope, different tool)" }
---

# Subagent-stall harness backstop — detect + auto-clear a stuck background-wait subagent (the reap/detect + regression AC #2833 deferred)

#2833 shipped only the delivery-path half of the subagent-stall fix (synchronous verify wrapper + `.lane-verify` marker + pr-land finish-guard + a PreToolUse(Bash) guard against backgrounding it). Two ACs are NOT delivered and are tracked here: (a) the harness/orchestrator DETECTING a subagent blocked on a never-advancing background wait past a threshold and REAPING (fail + reclaim its lane) or RESUMING it; (b) a regression reproducing a stalled build subagent and proving it clears automatically with its lane freed. Both lean on agent-runtime capability largely out of in-repo scope, so #2833 split them off rather than claim them.

## Definition of done

- A subagent blocked on a background wait past a threshold is auto-detected and reaped or resumed, with no main-session intervention.
- A regression reproduces the stalled-build-subagent scenario and proves it is cleared automatically and its lane freed.

## Mechanical data-collection design (detection inputs, not yet built)

Detection here is a **hookable** call (#51 — script-decidable belongs in a deterministic check, not
model judgment): given the right inputs, "stalled past threshold" is a plain comparison, not a verdict
that needs an LLM to read prose. The gap this item still owes is collecting those inputs on a schedule
and acting on them without a human/session in the loop — the existing on-demand health check already
proves the *read* side works; what's missing is the periodic *poll* side plus the reap/resume action.

**Signals to collect, all already on disk today, none newly invented:**

1. **Transcript last-activity timestamp** — `we:skills-src/inspect-agent-health/agent-health.mjs`'s
   bounded tail read already derives a verdict (`ACTIVE` / `IDLE_OR_STALLED` / `BLOCKED_ON_CHILD` /
   `BLOCKED_ON_TOOL`) from a JSONL transcript's newest entries and a quiet-time threshold (default
   180s). This is the primary per-agent liveness signal and needs no new instrumentation — only a
   caller that runs it on a schedule instead of on-demand.
2. **Lane occupancy record** — `we:.claude/lane-ports.json` (written by `we:scripts/lane-pool.mjs`)
   carries `workerSession` / `holder` / an implicit acquire-time per lane. Cross-referencing a lane's
   occupant session against that session's own transcript activity is what turns "this transcript looks
   idle" into "and it is still holding a lane no one else can use" — the actual harm this item exists to
   stop.
3. **Runner/process liveness where the wait is a background OS process, not just a quiet transcript** —
   the conveyor's own singleton runner lease directory (under the user's `~/.claude/` tree, outside this
   repo) records an owner, a pid, and a heartbeat timestamp; the same pid-liveness + heartbeat-staleness
   check generalizes to any long-lived background process a subagent spawned and is waiting on, not
   just the conveyor.
4. **The `.lane-verify` marker** `#2833` already writes (verify start/end timestamp + verdict) — a lane
   whose marker shows `unverified`/`verify-unfinished` far longer than any real verify run takes is a
   second, independent staleness signal that doesn't depend on transcript reads at all and keeps working
   even if a transcript is malformed or too large to tail cheaply.

**Proposed shape of the collector (not built here):**

- A small script (candidate home: `we:scripts/conveyor/`, alongside the other mechanized watches) that,
  on each conveyor tick, lists lanes with a `workerSession` set, resolves each to its transcript via the
  same id→path resolution the existing health-check script already implements, and records
  `{lane, sessionId, verdict, quietSeconds, laneVerifyState}` per lane — a pure read, no side effects, so
  it can be dry-run and diffed before it's trusted to act.
- Reap/resume is a **separate, explicit** second stage gated on that record: `IDLE_OR_STALLED` past a
  (probably longer, TBD) reap threshold AND `.lane-verify` stuck AND no live pid backing any recorded
  background wait → eligible for reap (fail the lane, run the existing lane-release path) or resume (a
  message-shaped nudge) per whatever policy this item's build settles on. Keeping detection and action
  as separate stages means the mechanical/deterministic half (collecting + comparing timestamps) can be
  tested and trusted independently of the reap policy, which is likely to need tuning.
- None of the four signals above requires new agent-runtime capability to *read* — they're all files or
  transcripts already written today. The out-of-repo-scope risk `#2833` flagged is confined to the
  *action* half (forcibly reaping/resuming a live subagent), not this data-collection half.
