---
bornAs: x5rr2eb
kind: epic
parent: "3383"
status: open
dateOpened: "2026-09-08"
relatedTo: ["3483", "3624", "3593", "3594", "3592", "3538", "3568", "2881", "3367", "3569", "3560", "3435"]
tags: []
---

# Proactive lane/session health monitoring: no per-lane rollup or orphaned-process detection exists

Tonight's operator ask for proactive, automatic lane/session health monitoring (not point-in-time queries) surfaced a real but partially-covered gap. Confirmed by reading code: we:skills-src/conveyor/supervisor.mjs (#3483) only supervises the RUNNER process (crash/idle backoff + 2 anomaly types) and is not even deployed; we:scripts/conveyor/session-reaper.mjs only reaps ground-truth-confirmed-done sessions; #3624/#3594/#3538/#2881 each cover one narrow failure shape and are mostly unbuilt. Nothing composes these into a per-lane health rollup, and nothing detects an orphaned OS process. This item scopes the aggregation gap and the open forks in how to close it.

## The evidence (2026-09-07/08, one operator, repeatedly, by hand)

Across one night, idle sessions, stranded markers, orphaned processes, and stuck `verify-lane` polls were each
found reactively — one at a time, by hand-inspecting transcripts and lane state with
`we:skills-src/inspect-agent-health/agent-health.mjs`, `node we:scripts/readiness/queue-report.mjs`, and `node
we:scripts/lane-pool.mjs status --json`. All three of the latter give a POINT-IN-TIME snapshot when queried —
none of them, nor anything else found in this survey, pushes a finding on its own schedule. The operator's ask
is specifically for the proactive half: something that watches continuously and surfaces a problem before a
human happens to look, not another on-demand query tool (already covered).

## What already exists — confirmed by reading the actual code, not secondhand summary

Every item below was read in full (source or backlog card) before being listed here, per this repo's own
capability-search doctrine (`we:backlog/3559-*.md`).

- **`we:skills-src/conveyor/supervisor.mjs` (`#3483`, landed 2026-09-06).** A resident restart/backoff wrapper
  around the conveyor tick RUNNER process only: classifies each child exit as `clean`/`crash`
  (`classifyExit`), backs off on repeated crashes or repeated idle-stops (`decideRestart`), and desktop-alerts
  on exactly two anomaly types read off its own JSONL history — `crash-loop-at-ceiling` and `idle-with-queue`
  (`detectSupervisorAnomalies`, `decideAlert`). It never calls `claude agents --json`, never reads any
  individual session's state or transcript, and — confirmed via `we:backlog/3624-*.md`'s own investigation the
  same week — **is not currently running anywhere**: no launchd plist is installed, and
  `we:skills-src/conveyor/runner.mjs` never spawns it ("a single supervisor is deferred (Option C)"). A prior
  subagent's secondhand characterization ("wraps the runner process + a queue-level alert, inspects nothing
  live") is accurate.
- **`we:scripts/conveyor/session-reaper.mjs` (`#3435`/`#3469`, landed, tick-wired every run).** Stops a
  background `claude agents` session, but ONLY once its target (a backlog item or PR) is independently
  ground-truth-confirmed done. It never inspects transcript content, and a session whose target is still open —
  however stuck — is left exactly as-is, `not-terminal`, forever.
- **`we:backlog/3624-*.md` ("Detect and recover a LIVE dispatched review/build session idle at prompt...",
  filed 2026-09-08, `status: open`, unbuilt).** Scoped to exactly one failure shape: a session idle at a
  top-level prompt with an empty/template-confused transcript, never having called
  `we:scripts/operations/completion-cli.mjs report --status=started`. Real, but narrow by its own design — it
  explicitly rules out the deadlock-shaped stall (`#2881`) and says nothing about a marker, a process, or a
  PR-review-neglect failure.
- **Epic `we:backlog/3593-*.md` + ratified decision `we:backlog/3592-*.md` + Stage 1
  `we:backlog/3594-*.md`.** The closest, most directly on-point prior art found — and it was scoped by the
  operator himself only the day before this ask (2026-09-07). `#3594` (Stage 1, `status: open`, size 8,
  unbuilt) is a report-only fleet-wide transcript scanner for two syntactic patterns: (a) a false
  "I've set up a monitor" claim with no matching `Monitor` tool_use nearby, and (b) a REAL `Monitor` tool_use
  whose command is a busy-spin wait loop with no `sleep` in its body. **Pattern (b)'s own card cites, as its
  live motivating example, almost the exact "stuck verify-lane poll" shape this ask names tonight** —
  `until [ -f /tmp/verify-lane-done.marker ] ...; do :; done`, a hallucinated marker path polled with no sleep
  at 95-98% CPU for 3.5+ minutes before being killed by hand. `#3592` (decision, ratified 2026-09-07) already
  answered "how does a Stage-2 judgment-supervisor get invoked and kept running" for this same family of
  problem: **Option A+C — a formalized, reusable dispatched-session skill, triggered by a scheduled recurring
  `/loop`/`/schedule` dispatch, NOT a persistent resident process (Option B).** Option B was explicitly
  deferred, "revisit only if Stage 1 data shows instruction-slips recur faster than a periodic dispatch cadence
  can catch." `#3617` tracks generalizing this into the Plateau Loop coordinator's own child-supervision once
  it's proven out here.
- **`we:scripts/conveyor/lane-pool-health-watch.mjs` (`#3568`, landed, tick-wired, auto-reap).** Reclaims
  stranded lane litter — but only for an UNLEASED lane whose entire `git status --porcelain` output matches a
  narrow allowlist. A leased lane, or any lane carrying one non-allowlisted dirty path, is never touched, and
  it does nothing about a stranded marker file's own staleness (see next item) or a live process.
- **`we:backlog/3538-*.md` ("A lane-verify marker outlives its landed PR...", `status: open`, unbuilt).** One
  specific stranded-marker bug: `.git/.lane-verify` stays `green` for a sha that already merged, permanently
  blocking the next verify in that lane. A point fix for one marker's one staleness cause — not a general
  "is any marker in this lane stale" detector.
- **`we:scripts/conveyor/parked-pr-progress-watch.mjs` (`#3549`/`#3550`, landed 2026-09-08, tick-wired,
  alert-only).** A neglect watch for PARKED PRs specifically (no review ever dispatched, 24h+, via GitHub's own
  label-apply timeline) — a different axis entirely (PR review-label state, not a live session/process/marker).
- **`we:backlog/2881-*.md` ("Subagent-stall harness backstop", `status: open`).** Harness-level auto-reap/
  resume for a subagent blocked on a background wait past a threshold. Still explicitly deferred — its own
  scoping note says it "leans on agent-runtime capability largely out of in-repo scope."
- **`we:backlog/3367-*.md` ("Watch for progress instead of giving up on a clock", `status: open`).** Replaces
  three specific hardcoded deadlines inside `we:scripts/operations/dispatch-lane-io.mjs` and
  `we:scripts/operations/dispatch-lane.mjs` with a progress/liveness-based watchdog. Narrow to those three call
  sites — not a fleet-wide health sweep.
- **`we:backlog/3569-*.md` (rolling 24h capacity monitor, `status: open`) and `we:backlog/3560-*.md` (live
  queue-status Artifact, `status: open`, `blockedBy: ["3277"]`).** Both explicitly scoped as OBSERVABILITY of
  capacity/queue state, not health. `#3560`'s own text: "queue observability, not full conveyor health."
  `#3569` is a historical utilization/throughput trend, not a stuck-work detector.
- **`node we:scripts/readiness/queue-report.mjs`, `node we:scripts/lane-pool.mjs status --json`.** On-demand,
  point-in-time snapshots, used repeatedly tonight for manual checks. Confirm the gap rather than close it —
  useful once queried, never proactive.

## The confirmed, genuine gap — not covered by anything above, built or unbuilt

1. **No orphaned-OS-process detector anywhere.** Grepped `we:backlog/*.md` and every `we:scripts/`/
   `we:skills-src/` file for "orphan" — every real hit is about an orphaned lane LEASE, branch, or review
   VERDICT; none is about a leftover OS process (a stray `verify-lane` or `node` child whose parent session
   died or was killed). This is a real, un-scoped failure class on its own.
2. **No per-lane health ROLLUP.** Every mechanism above watches exactly one narrow axis in isolation — the
   runner process, a session's ground-truth-done state, PR review-neglect, lane litter, one marker's staleness,
   a transcript's syntactic claims. Nothing composes them into a single "is lane-N actually healthy right now"
   verdict a human or the conveyor can check or be alerted from in one place. Getting that answer tonight took
   cross-referencing several of the on-demand tools above by hand.
3. **Alerting is scattered and inconsistent.** `we:skills-src/conveyor/supervisor.mjs` can desktop-alert but
   isn't even running; `we:scripts/conveyor/lane-pool-health-watch.mjs` is silent (auto-reap only);
   `we:scripts/conveyor/parked-pr-progress-watch.mjs` posts a GitHub label (routes into the fix/review cycle
   eventually, not an immediate human-facing alert); `#3594` Stage 1 is report-only (log/print, no alert at
   all). There is no one channel a human watches for "the fleet needs attention now."
4. **Even fully built, the existing/planned pieces don't guarantee tonight's four named shapes are all caught.**
   `#3594` (once built) catches the busy-spin-poll shape and the false-claim shape. `#3538` (once built) fixes
   one specific marker-staleness cause. Neither, even together, catches a marker left behind with a dead
   process and no transcript claim at all, or a truly orphaned process with nothing pointing at it.

## Proposed shape (grounded in the pattern this codebase already uses eight times over, not invented)

Given `#3592` already ratified "no new resident process, for now" for the closely-related instruction-slip
supervisor — and every other mechanical-health check under `#3383` (`we:scripts/conveyor/session-reaper.mjs`,
`we:scripts/conveyor/lane-pool-health-watch.mjs`, `we:scripts/conveyor/parked-pr-progress-watch.mjs`,
`we:scripts/conveyor/duplicate-pr-watch.mjs`, `we:scripts/conveyor/parked-pr-conflict-watch.mjs`) is a
stateless pass wired into `we:skills-src/conveyor/runner.mjs`'s existing tick loop rather than its own resident
daemon — the leverage-maximizing shape is likely:

- **Build the two already-designed, currently-unbuilt pieces that close two of tonight's four named shapes
  outright**: `#3594` Stage 1 (busy-spin/stuck-poll + false-claim transcript scan) and `#3538` (the lane-verify
  marker staleness fix). Both are fully scoped cards sitting idle, not new design.
- **Add what neither covers**: (a) an orphaned-OS-process check, and (b) a new aggregation pass — a
  `lane-health` sweep, wired into the same tick cadence as its seven siblings — that composes the OUTPUT each
  existing/planned per-axis check already produces (or could easily be asked to produce) into one per-lane
  verdict, and fires through the SAME desktop-notification mechanism
  `we:skills-src/conveyor/supervisor.mjs` already implements (reused, never reinvented) rather than a new
  alerting channel.

## Open forks — explicitly NOT resolved here

**Fork 1 — where does the aggregation live?**
- (a) Extend `we:skills-src/conveyor/supervisor.mjs` itself — it already owns anomaly-detection + alerting
  machinery, but it is process-scoped (watches the runner child, not individual lanes) and isn't even deployed
  today; extending it also means finally deploying it.
- (b) A new sibling mechanical pass in `we:skills-src/conveyor/runner.mjs`'s tick list — matches every other
  check built under `#3383` exactly (the established "piggyback the tick" shape), needs no new resident-process
  capability.
- (c) Fold into `#3593`/`#3594`'s Stage 2 judgment-supervisor once it exists — it's already scoped to consume
  Stage 1's scanner output and apply judgment, a plausible home for "is this lane healthy" too, but its own
  ratified invocation shape (`#3592`) is dispatched-on-schedule, not a tick-wired pass, and its scope today is
  instruction-slips specifically, not process/marker/orphan health.

**Fork 2 — how does orphaned-process detection actually work?**
- (a) Cross-reference `claude agents --json`'s live session list against actually-running PIDs recorded at
  spawn time — accurate, but needs a NEW PID-recording mechanism; nothing today persists a session's own child
  PIDs anywhere.
- (b) A heuristic process-tree scan for known command patterns (`verify-lane`, a `node` child under a lane
  path) whose parent is gone — cheaper, no new recording needed, but riskier: a legitimately long-running
  `verify-lane` with a since-exited launcher could false-positive.

**Fork 3 — does tonight's evidence warrant revisiting `#3592`'s "no resident process, periodic dispatch is
enough" ruling, or is it simply evidence that already-filed-but-unbuilt work (`#3594`, `#3538`) needs to
actually get built?** Every one of tonight's four named incidents happened BEFORE any of `#3594`/`#3538`/
`#2881` were built — so they are not yet evidence that a periodic-dispatch cadence is too slow; they may just be
evidence of an unworked backlog. **Recommend treating this as NOT yet grounds to revisit `#3592`**, and
revisiting only if the same shapes recur again after those land — exactly the revisit condition `#3592` itself
already names.

**Fork 4 — alerting channel, once a per-lane verdict exists.**
- (a) Desktop notification, matching `we:skills-src/conveyor/supervisor.mjs`'s existing precedent — reaches
  whoever is at that specific Mac, nowhere else.
- (b) A `lane-health` report command, matching `we:scripts/readiness/queue-report.mjs`'s existing on-demand
  shape — accurate but not "proactive" by itself unless something else also pushes it on a schedule.
- (c) Route a stuck-lane finding through `we:scripts/conveyor/reconcile-finding.mjs` the way
  `we:scripts/conveyor/parked-pr-progress-watch.mjs` already does, so it becomes a queued fix/escalation the
  conveyor itself acts on — the most mechanically "proactive" option, but means teaching the conveyor to
  safely intervene in a LIVE session, which is exactly the capability `#2881`'s own scoping judgment already
  flagged as leaning on "agent-runtime capability largely out of in-repo scope."

None of these four forks is picked here. This item exists to scope the gap and lay out the shape and its
open questions for the operator to talk through, not to rule on them.

## Done when

1. Fork 1 (aggregation home), Fork 2 (orphan-detection mechanism), and Fork 4 (alerting channel) are each
   discussed with the operator and a choice recorded — either inline here or carved into their own `decision`
   item(s), per this repo's own rule that a fork never lives inline in a build item once it's ready to be
   ratified (mirroring how `we:backlog/3549-*.md` was carved out of `we:backlog/3550-*.md`).
2. This epic is `/slice`d into buildable stories once the forks above are ratified — at minimum: an
   orphaned-process detector, and a `lane-health` aggregation pass wired into
   `we:skills-src/conveyor/runner.mjs`'s tick loop per whichever Fork-1 answer is ratified.
3. `we:backlog/3594-*.md` and `we:backlog/3538-*.md` are tracked as this epic's own highest-leverage
   prerequisite builds (not rebuilt here) — they already close two of tonight's four named failure shapes and
   should land before or alongside this epic's own new pieces.
