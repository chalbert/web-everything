---
bornAs: xwysd8b
kind: decision
parent: "4075"
status: active
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
preparedDate: "2026-09-24"
preparedAgainstSha: "069777614be672823ba0777cd4952d075cf2f8ae"
relatedReport: reports/2026-09-24-conveyor-operator-policy-calls.md
relatedTo: ["3366", "3367", "3368", "2881", "4071", "4065"]
tags: [conveyor, daemons, sessions, operator-policy, incident-2026-09-24, decision-prep]
---

# Operator-pending conveyor policy calls: session-cleanup retention, stuck-bot timeout, cleanup scope, daemon bots on an API key, auto-resume of interrupted workers

Five operator calls left open on 2026-09-24. Prep turned them into **three forks and two non-forks**.
Retention (Fork 1), stuck-bot stopping (Fork 2) and who resumes (Fork 3) each have a branch that breaks
something, so each default is close to forced. Auto-resume itself is already decided by #3366 and a ratified
statute, so only "who resumes" is left. Cleanup scope and the API-key question are not forks: one is a
build-order note, the other a per-bot setting. Grounding and prior art:
`we:reports/2026-09-24-conveyor-operator-policy-calls.md`.

## Axes

- **When a finished session's records may be deleted** (Fork 1).
- **What stops a bot that is not making progress** (Fork 2).
- **Who may resume an interrupted worker** (Fork 3).
- **Which sessions cleanup may touch** — ruling plus a build-order note (Supported by default).
- **Which credential a bot runs on** — a per-bot setting (Supported by default).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 — retention | **(c)** keep until the served card and PR are finished, then 1 day; a 30-day ceiling | (b) fixed 7 days | high (forced) |
| 2 — stuck bot | **(b)+(c)** per-kind no-outcome window, plus a per-kind ceiling | (a) one wall clock | high (forced) |
| 3 — who resumes | **(b)** one resumer: the dispatcher role that holds the run record | (c) any watcher, e.g. the health daemon | high (forced) |

## Fork 1 — When may a finished session's records be deleted?

Fork-existence: (a) and (b) are broken, not just worse. A fixed clock deletes a session while its PR is still
open, but fix work resumes the PR's original builder by session id
(`we:scripts/conveyor/reconcile-fix-dispatch.mjs:540`, statute
[#parked-pr-conflict-dispatched-not-scripted](/docs/agent/platform-decisions/#parked-pr-conflict-dispatched-not-scripted)).
Deleting that session forces a cold relaunch, which is the exact loss #3366 exists to prevent.

Today nothing is deleted: the reaper only runs `claude stop`
(`we:scripts/conveyor/session-reaper.mjs:640`). The Claude Code jobs directory holds 1581 entries, and
`.operations/runs/` holds 92. Delete helpers exist but nothing calls them
(`we:scripts/operations/run-store.mjs:121`). Transcripts are already deleted by Claude Code's own
`cleanupPeriodDays` setting (default 30 days).

- (a) 1 day after the session ends. Excluded (above).
- (b) 7 days after the session ends. Excluded (above); a PR can sit in review longer than 7 days.
- **(c) Keep until the work it served is finished, then 1 day, with a ceiling.** A session's records
  (its background-session entry via `claude rm`, run records, completion records, delivery reports and
  lane-port mappings) become deletable only when all three hold:
  1. its card is resolved or withdrawn, and its PR (if any) is merged or closed;
  2. its introspection has run (statute
     [#automated-session-introspection](/docs/agent/platform-decisions/#automated-session-introspection)
     reads every terminal session's transcript);
  3. its cost has been rolled up. This condition applies only once #4071 exists. Until then, conditions 1
     and 2 are enough; the third condition switches on when #4071 ships, with no new ruling.

  Then it is deleted after a 1-day grace. The ceiling is our own named setting. Its default is the host's
  `cleanupPeriodDays` (30 days today), but it can be changed independently. A default at or below the
  transcript retention means a record rarely points to a transcript that is already gone. The ceiling also
  covers a card that never finishes (a parked card).

Default: **(c)**. The grace and ceiling are settings, not part of the ruling.

Skeptic: SURVIVES-WITH-AMENDMENT (independent headless seat, `judgePanel`, run `prep-4082`). Two findings
folded in. (1) The cost condition referred to a card not yet built, so records could never be deleted
before it ships. The interim behavior is now stated. (2) The ceiling live-read a Claude Code setting
meant for a different kind of data. It is now our own setting, with that value as its default.
Screen: clear. When records disappear is observable to the operator, and a fixed clock against a
still-open PR is a real merit loss, not build order.

## Fork 2 — What stops a bot that is not making progress?

Fork-existence: (a) is broken. One wall clock kills slow-but-healthy work on a busy machine; #3367 records
that exact failure on 2026-08-27. Silence alone is also broken. Today a session is stopped after 30 minutes
without a new transcript entry (`we:scripts/conveyor/hung-session.mjs:68`). A looping bot writes constantly,
so it is never silent and never stopped. The ratified runner statute already treats "killed for looping"
as a real stop reason
([#agent-runner-cli-backend](/docs/agent/platform-decisions/#agent-runner-cli-backend) Fork 3).

- (a) A fixed wall clock (e.g. 60 min). Excluded (above).
- **(b)+(c) Two windows per bot kind, as Temporal's heartbeat and start-to-close timeouts do:**
  1. **No-outcome window.** No *outcome* for N minutes means stop. An outcome is something the work
     produces, not transcript noise:

     | Kind | Outcome |
     | --- | --- |
     | build | the lane's net diff against its base changed |
     | fix | commit or push that changes the net diff |
     | review | review comment or label |
     | prepare | item file change |

     Only a *net* change counts. A commit that leaves the lane's diff against its base the same as at the
     last outcome (a whitespace churn, a revert, an edit-and-undo loop) does not reset the window.
     Transcript silence (the existing 30-min check) stays as the fast path.
  2. **Ceiling.** A hard per-kind maximum. It must be **no longer than the lane lease TTL** (240 min,
     `we:scripts/lib/lane-lease.mjs:35`), so a live bot never outlives its lease and has its lane handed to
     someone else.

  Stopping follows the statute: graceful stop first, then SIGTERM. A bot stopped for no outcome is recorded
  as `stalled`, which #3366 treats as a loop, so it is relaunched fresh and never resumed.
- (c) alone, per-kind wall clocks. Excluded: still a clock (same failure as (a)).

Default: **(b)+(c)**. The first values come from #3368's step timings (about twice each kind's p95).
Until that data is read, the values are: build 45 / 240, fix 30 / 120, review 30 / 60, prepare 45 / 180
minutes. The numbers are settings.

Skeptic: SURVIVES-WITH-AMENDMENT (independent headless seat, run `prep-4082`). It showed that "any commit"
as an outcome lets a looping bot reset its window with trivial commits and run to the full ceiling. The
outcome is now a *net* diff change. Even unamended, the default beats today, where a looping bot is never
stopped.
Screen: clear. Which work gets stopped, and when, is observable. With both branches free to build, a
single clock still kills healthy slow work, so the merit difference remains.

## Fork 3 — Who may resume an interrupted worker?

Settled already, not re-ruled here: an interrupted worker is **resumed, not relaunched**, when its session
still exists and is not poisoned. A worker that is gone, or was stopped for looping or no outcome, is
relaunched fresh. Resume attempts are capped. Sources: #3366 (filed at the operator's request; blocked by
#3331) and [#agent-runner-cli-backend](/docs/agent/platform-decisions/#agent-runner-cli-backend) Fork 3.
The open question is whether resume has one owner or several.

Fork-existence: (c) is broken. Two actors able to resume the same session race each other. The resume
command is a bare `claude --bg --resume <id>` (`we:scripts/operations/dispatch-lane-io.mjs:1173`), and two
resumes of one id make two copies working the same lane.

- (a) Never resume; always relaunch. Excluded: contradicts #3366 and the statute.
- **(b) Exactly one resumer: the dispatcher role that holds the worker's run record and resume cap**
  (#3366 Done-when 4). It resumes on its next tick. It is a *role*, not one process: the run record is on
  disk, so a restarted or replacement instance of the same daemon (singleton lease, under
  [#resident-daemon-reload-lifecycle](/docs/agent/platform-decisions/#resident-daemon-reload-lifecycle))
  picks the resume up. If the role stays down, the lane lease and guard TTLs already return the work for a
  fresh relaunch. Chat-spawned workers are never auto-resumed; the operator drives them.
- (c) Any watcher may resume, e.g. the health daemon. Excluded (above). Other watchers *report* a worker
  its owner failed to resume.

Default: **(b)**. #3366 is the build. This fork adds one line to its scope: "resume is single-owner — only
the dispatcher role resumes".

Skeptic: SURVIVES-WITH-AMENDMENT (independent headless seat, run `prep-4082`). It argued the default had no
failover if the dispatching daemon itself died. Answered: resume belongs to the role, not the process. The
run record is durable, and a restarted instance picks the resume up. If the role stays down, the existing
lease and guard TTLs fall back to a relaunch. Both points are now written into the option.
Screen: flagged(impl) → fixed. The draft asked "which daemon", which the operator cannot observe. It is now
the observable rule (a single resumer, others only report). The daemon identity is a note inside the
option.

## Supported by default (config dimensions and precedents — not forks)

- **Cleanup scope: daemon-dispatched sessions always; a chat-spawned background session only when linked
  to its spawning chat *and* that chat was explicitly ended.** Explicitly ended means a terminal event such
  as a close or stop command. An idle, disconnected or closed-window chat is *not* ended. Any unknown or
  ambiguous link is never reaped. Reaping every session, chat workers included, is excluded: it would kill
  a worker the operator is still driving. The reaper already refuses non-background rows for this reason
  (`we:scripts/conveyor/session-reaper.mjs:162`). This was a fork in the first draft. The fresh-context
  screen flagged it as prioritization: "daemon only" and this rule differ only until the spawn link exists,
  and then this rule strictly dominates. The build is to stamp the spawning chat at spawn time; until it
  lands, the behavior equals today's. Agent-tool subagents are out of scope: they never appear in the
  session listing, and their stalls belong to #2881. Skeptic amendment folded in: "ended" must be explicit,
  never inferred.
- **Bot credential: a per-bot setting, default the operator's subscription login.** Subscription and API
  key can coexist bot by bot, so this is a setting, not a fork. The statute already rules the order:
  subscription CLI now, API-key backend later behind the same interface
  ([#agent-runner-cli-backend](/docs/agent/platform-decisions/#agent-runner-cli-backend)). Today no
  per-bot setting exists; every bot inherits the CLI login
  (`we:scripts/operations/deliver-item-wrapper.mjs:489`). The build is the setting itself (a build child).
  **Trigger for moving a bot to an API key**, per bot, once #4071 reports cost:
  - bot usage causes the operator to hit a usage limit at least once in a week; or
  - that bot uses more than a third of the weekly subscription allowance.

  Moving a bot to an API key does **not** by itself lift the `--bare` ban
  (`we:scripts/lib/judge-spawn.mjs:49`). That ban is a mechanical trap guard, not a statute: `--bare` reads
  only an API key, so on the subscription it fails with "Not logged in". Letting an API-key bot use `--bare`
  would be a separate, reviewed change to that guard. (Skeptic finding, folded in.)
- **All numbers are settings** (grace, ceiling, windows): env-overridable named constants, the way
  `we:scripts/conveyor/hung-session.mjs:112` already does it.

## Proposed codified text (drafted; ratify verbatim or amend)

A new anchor `#conveyor-session-lifecycle-policy` in `we:docs/agent/platform-decisions.md`:

> 1. A finished conveyor session's records are deleted only after its card is resolved or withdrawn, its
>    PR (if any) is merged or closed, its introspection has run and (once cost tracking exists) its cost
>    is rolled up — then after a grace, and in any case by a ceiling setting that defaults to the host's
>    transcript retention.
> 2. A bot is stopped when its work shows no net outcome within its kind's window, or it reaches its kind's
>    ceiling; the ceiling never exceeds the lane lease TTL. Transcript silence stays a faster stop.
>    Stopping is graceful first, then SIGTERM; a no-outcome stop counts as a loop and is relaunched, never
>    resumed.
> 3. Resume is single-owner: only the dispatcher role holding the worker's run record resumes it; any other
>    watcher reports, never resumes. Chat-spawned workers are never auto-resumed.
> 4. Cleanup touches daemon-dispatched background sessions, and a chat-spawned background session only
>    when linked to a spawning chat that was explicitly ended; an unknown or ambiguous link is never reaped.
> 5. A bot's model credential is a per-bot setting, defaulting to the operator's subscription; changing it
>    does not by itself lift any spawn-flag guard.

## Build children (filed at ratification, not before)

| Child | Scope (predicted) |
| --- | --- |
| Retention sweep for finished sessions (Fork 1) | `we:scripts/conveyor/session-reaper.mjs`, `we:scripts/operations/run-store.mjs` |
| Per-kind no-outcome window + ceiling (Fork 2) | `we:scripts/conveyor/hung-session.mjs`, `we:scripts/conveyor/session-reaper.mjs` |
| Stamp the spawning chat on chat-spawned background sessions (cleanup scope) | `we:scripts/conveyor/`, `we:.claude/settings.json` (a SessionStart hook) |
| Per-bot credential setting (Supported by default) | `we:scripts/operations/dispatch-lane-io.mjs` |
| Fork 3: add "resume is single-owner" to #3366 | card edit only |

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## Done when

1. **Executable** — each fork carries a ruling and `codifiedIn:` is set, and the rulings are wired into the
   code paths that read them (session reaper, stuck-bot timeout, dispatch auth) through the build children
   above.
