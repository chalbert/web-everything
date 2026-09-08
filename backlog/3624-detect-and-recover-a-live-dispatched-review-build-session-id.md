---
bornAs: xuk9o8s
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:skills-src/conveyor/runner.mjs", "we:skills-src/inspect-agent-health/agent-health.mjs", "we:scripts/operations/completion-cli.mjs"]
dateOpened: "2026-09-08"
tags: []
---

# Detect and recover a LIVE dispatched review/build session idle at prompt with an empty/template-confused transcript

Live incident 2026-09-08 in checkout /Users/nicolasgilbert/workspace/wev-scratch-dispatcher-4 (runner pid
42128, branch lane/mechanical-dispatcher): 11 `review-*` dispatched sessions sat in `claude agents --json
--all` state `blocked` for 3300-17500+ seconds, each idle at a top-level prompt ("I'm ready. What would you
like me to do?" / explicit "the brief above is a template with unfilled placeholders" complaints), never
having called `we:scripts/operations/completion-cli.mjs report --status=started`, and never producing any
review output. Root cause of WHY they were confused was we:backlog/3606-*.md (resolved earlier the same day
via PR #2066, e712c9cc9) -- all 11 stuck sessions were dispatched BEFORE that fix merged (confirmed via
`claude agents --json` startedAt vs `git log -1 --format=%cI e712c9cc9`), so they are stale orphans of an
already-fixed bug, not a live code defect. But nothing in the system detected or cleared them -- they were
found only via manual transcript inspection (`node we:skills-src/inspect-agent-health/agent-health.mjs
<transcript> --lines=30`) and manually stopped one by one via `claude stop <id>` (session ids:
c63f28af/review-2045, c4cbc765/review-2042, 3f486862/review-2048, 5189f0b1/review-2024,
544a2ea8/review-1985, afb40a1e/review-2052, 87cf2c22/review-2056, 2028a384/review-2054,
a67767e9/review-2057, 2b952430/review-2059, 8d248e79/review-2067).

This item asks for the general capability that would have caught and cleared all 11 automatically: a
dispatched review/build session that ends up idle with nothing real to do -- whatever the specific cause
(a confusing brief, no PR actually ready, a self-abort) -- should be automatically detected and recovered
(fed real queued work if any exists unassigned, or stopped with its lane lease released) rather than sitting
forever until a human happens to check.

Checked and ruled out as already covering this:
- `we:scripts/conveyor/session-reaper.mjs` (we:backlog/3435-*.md / we:backlog/3469-*.md, resolved, runs
  every tick via `we:skills-src/conveyor/runner.mjs`'s `runQuiet('we:scripts/conveyor/session-reaper.mjs')`) only reaps
  a session once its TARGET is independently ground-truth-confirmed done (backlog item `status: resolved` or
  PR merged) even though `claude agents` itself still shows `working`/`blocked`. It never inspects transcript
  content, and all 11 stuck sessions' target PRs were still OPEN and needing review -- session-reaper would
  never touch them.
- `we:skills-src/conveyor/supervisor.mjs` (we:backlog/3483-*.md, resolved/landed on main, ~555 lines) is a
  crash/idle-stop restart wrapper around the runner PROCESS itself (backoff on crash-loop) plus one
  queue-LEVEL alert (`idle-with-queue`: ticking with items queued but zero dispatched for several ticks). It
  does not read `claude agents --json`, does not look at any individual session's state or transcript, and is
  not even currently running in this environment (no launchd plist installed; `we:skills-src/conveyor/runner.mjs` doesn't spawn it --
  "a single supervisor is deferred (Option C)").
- we:backlog/2881-*.md ("Subagent-stall harness backstop") is open but scoped to a DIFFERENT failure shape: a
  subagent blocked mid-tool-call on its OWN never-advancing background wait/monitor (a nested deadlock). Our
  sessions are not blocked on any tool call -- they are conversationally idle at a top-level prompt with
  nothing pending, waiting for input from a human that will never come in a headless dispatch. Different
  detection signal (transcript-tail inspection a la `we:skills-src/inspect-agent-health/agent-health.mjs`'s
  existing IDLE_OR_STALLED verdict, not a stuck-tool-call heuristic) and a different recovery action (feed
  real work or stop+release, not resume a paused monitor). This item is the general/idle-at-prompt sibling of
  #2881's deadlock-specific case, both under conveyor epic #3383 -- kept separate because the detection signal
  and the fix are materially different, not consolidated into #2881.
- A grep across backlog/*.md for "idle session", "stalled dispatch", "reap idle review session", "supervisor
  auto-recover" found nothing else on point.

Suggested fix direction (not prescriptive): extend `we:scripts/conveyor/session-reaper.mjs` with a second,
separate axis (or a new sibling pass wired into `we:skills-src/conveyor/runner.mjs` alongside it) that, for a
`claude agents` row still `working`/`blocked` whose ground-truth target is NOT yet confirmed done,
additionally reads a bounded tail of that session's own transcript (reusing
`we:skills-src/inspect-agent-health/agent-health.mjs`'s existing IDLE_OR_STALLED heuristic rather than
re-deriving it) and, when it is genuinely idle with no real work ever started (no `we:scripts/operations/completion-cli.mjs report
--status=started` call, no tool activity for well past the idle threshold), either (a) checks whether there
is still real unassigned queued work for that session's target and re-dispatches/feeds it, or (b) stops the
session and releases any lane lease it holds via `we:scripts/lane-pool.mjs release`. Note: nothing downstream
currently reads the `we:scripts/operations/completion-cli.mjs` `outcome` field at all (confirmed by direct
grep across scripts/ -- it is free text, never branched on by any caller) -- any fix that wants to use "did it
ever report started" as a signal needs that read path built out; today only the `show` subcommand exposes it,
and only as a manual read.

## Done when

1. **Executable** — a pure classifier (mirroring `we:scripts/conveyor/session-reaper.mjs`'s
   `classifySessionReap`/`classifySessionReapWithGroundTruth` split) takes one `claude agents --json` row plus
   a bounded transcript-tail read for it and returns a verdict distinguishing "genuinely idle, no real work
   ever started" from "still working" — unit-tested directly on fixtures (a template-confused idle transcript
   like the 11 live examples above, a genuinely mid-task transcript, an empty/missing transcript) with no
   fs/exec/clock in the pure core, the same split `we:scripts/conveyor/session-reaper.mjs`'s own header
   documents and justifies.
2. **Executable** — wired into `we:skills-src/conveyor/runner.mjs`'s per-tick pass list (alongside the
   existing `runQuiet('we:scripts/conveyor/session-reaper.mjs')` call) or folded into
   `we:scripts/conveyor/session-reaper.mjs` itself as a second axis; a regression test reproduces one of the
   11 live shapes (idle-at-prompt, no `we:scripts/operations/completion-cli.mjs report --status=started` ever
   called, target PR still open) and proves the pass recovers it: `--dry-run` reports it as a reap-or-refeed
   candidate, and a real run either re-dispatches it (if unassigned queued work for its target still exists)
   or calls `claude stop <id>` + releases any held lane lease via `we:scripts/lane-pool.mjs release`.
3. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/session-reaper.test.mjs` (or the new
   sibling test file, if built as a separate pass) passes with the new coverage.
4. `npm run check:standards` stays green.
