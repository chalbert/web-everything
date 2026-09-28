---
bornAs: x61epyr
kind: story
size: 5
parent: "4075"
status: active
blockedBy: ["4065", "4077"]
scope: ["we:scripts/conveyor/health-investigate-dispatch.mjs", "we:skills-src/conveyor/health-investigate-brief.md", "we:scripts/conveyor/health-watch-core.mjs", "we:scripts/operations/dispatch-lane.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-28"
tags: [health-daemon]
---

# Health daemon slice 2: auto-dispatch a diagnose-only investigation agent per smell episode

Second slice of 4065 (Fork 2). When an agent-eligible smell opens an episode and its deterministic
diagnosis did not settle the cause, dispatch one diagnose-only agent:

- Launched as a **new kind on the declared `dispatch-lane` operation**
  (#conveyor-dispatch-calls-the-declared-operation clause 1), not by importing the spawner the stuck-PR
  inspector uses. The model comes from dispatch routing for the investigator role (never hand-set).
- **Tool surface: declared read operations only** (runner-activity, stale-state, dispatch-eligibility,
  github-app-status, bounded transcript reads). Edit, Write and every `gh` write, including
  `gh pr comment`, are denied — the agent reads untrusted transcript text.
- **Budget**: one per episode, 1 running at a time, 6 per rolling 24 h, a 20-minute wall clock enforced by
  stopping the session through we:scripts/conveyor/session-reaper.mjs; no dispatch while an inhibiting
  episode (App token / rate limit, high load) is open; no fourth investigation on a (smell, subject) within 7
  days.
- **Output**: evidence with cited command output and a structured recommendation (what is wrong, the product
  change that fixes it, one-line next step) written into the episode report after the privacy scrub of
  #automated-session-introspection clause 3. Never applies a fix.
- Stays off in `shadow` until the operator turns dispatch on.

## Done when

1. **Executable** — tests prove: the dispatch plan refuses a second agent for the same episode, refuses
   under an inhibiting episode, refuses past the 24 h budget; the spawned argv carries the read-only tool
   surface (Edit, Write, `gh pr comment` denied).
2. **Live proof** — with dispatch turned on, one real episode yields one investigation whose findings land in
   the episode report, and the session is reaped at or before the wall clock.

## Progress

- [x] **Kind on `dispatch-lane`** — `HEALTH_INVESTIGATE_KIND` (`health-investigate`) in
  we:scripts/operations/dispatch-lane.mjs: `EPISODE_ID`/`SMELL` registered in `BRIEF_PLACEHOLDERS`, its own
  `BRIEF_REQUIRED_BY_KIND` row, `sessionSlugFor` → `health-<episodeId>`. Deliberately NOT in `LAUNCH_KINDS`
  (that list is the tick core's item-and-lane launch lists; an episode has neither). Spawned through the one
  sink, we:scripts/operations/dispatch-lane-io.mjs `createDispatchSinks` — the same shape
  we:scripts/operations/ci-heal-pr-dispatch.mjs uses. Model = `decideDispatchRoute({kind:'investigate'})`'s
  tier (sonnet), never hand-set.
- [x] **Read-only tool surface** — `healthInvestigateToolArgs`: deny Edit/Write/MultiEdit/NotebookEdit, `gh`
  wholesale plus `gh pr comment` by name, `git`, curl/wget, `claude stop`/`rm`, and every declared operation
  except runner-activity / stale-state / dispatch-eligibility (a test pins this against the operations
  registry); the allow-list pre-approves those reads, github-app-status, the bounded transcript read and the
  agent's own `show`/`record`. No lane is granted Edit/Write.
- [x] **Budget** — pure `planInvestigations` (we:scripts/conveyor/health-investigate-plan.mjs): one per episode,
  1 running, 6 per rolling 24 h, no fourth on a (smell, subject) in 7 days, inhibited while a
  bad-credentials / gh-graphql-budget / gh-call-failures / machine-overload / claude-auth-expired episode is
  open, held while a declared diagnosis has not run or a smell's optional `diagnosisSettles` says it settled.
  Every number is health config; `investigateDispatch: false` by default (stays off in shadow).
- [x] **Wall clock** — 20 min, stopped via we:scripts/conveyor/session-reaper.mjs `stopSessionWithRetry` on the
  first tick within `investigateReapLeadMs` (5 min, the tick cadence) of the deadline, so never after it;
  stopped at once when findings land.
- [x] **Output** — the agent's one write is the dispatcher's `record` verb (own episode + own session only,
  once), shape-checked and scrubbed (home → `~`, `scrubText`, then #automated-session-introspection's
  `scrubReasons` per line, keeping the path/code reasons that are the evidence). Rendered into the episode
  report as "Agent investigation"; appended once to the report of an episode that closed before findings landed.
- [x] **Wired into the tick** — we:scripts/conveyor/health-watch.mjs calls `runInvestigations` after diagnoses
  (`--no-investigate` skips it; `--dry-run` decides without acting).
- [x] **Executable proof** — we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs (26 tests, incl.
  the real sink + real brief with a fake `claude` asserting the argv) plus two core tests in
  we:scripts/conveyor/__tests__/health-watch-core.test.mjs.
- [ ] **Live proof** — needs the operator to set `investigateDispatch: true` in the health config file and one
  real investigate-action episode; not runnable from a build lane.
