---
kind: task
status: active
scope: ["we:scripts/conveyor/tick-core.mjs"]
relatedTo: ["3383", "3403"]
scaffoldedBy: "investigate-15-stuck-prs"
dateScaffolded: "2026-09-05"
dateOpened: "2026-09-05"
tags: [conveyor, dispatch, duplication]
---

# graduate the durable build-guard floor (#3403) from lane/mechanical-dispatcher to main -- the confirmed root cause of the #3478/#3230/#2819/#3481 quadruple-dispatch storm

Commits b45e1b8c4 + 7d1b53b42 (tick-core: durable floor for the in-flight build guard, #3403) exist ONLY on origin/lane/mechanical-dispatcher -- NOT an ancestor of main (confirmed via git merge-base --is-ancestor). we:scripts/conveyor/tick-core.mjs's in-flight BUILD guard (bookkeeping.buildGuards) is SESSION-EPHEMERAL: it lives only in the calling process's own memory, piped in on stdin each tick, and is wiped by a restart or lost across ticks. When that happens, a build whose delivery agent is genuinely still alive and working (confirmed live 2026-09-05 via claude agents --json: session conveyor-3230h, pid alive, state blocked/idle for 6.3 hours -- also conveyor-3481b 7.5h, conveyor-3189e 5.8h, conveyor-3484 11.2h, prepare-2768 15.7h, all real live pids never reaped by session-reaper because blocked-on-permission is a deliberate non-reaped state, not a bug) reads, from we:scripts/readiness/conveyor-state.mjs's own ground truth alone, EXACTLY like a never-dispatched item -- no leased lane yet, still in the cleared build queue -- so we:scripts/conveyor/tick-core.mjs re-launches a SECOND, independent delivery agent for the SAME backlog item while the first is still alive. This is the confirmed root cause of the quadruple-PR storm on #3478 (PRs #1933/#1935/#1937/#1939) and the double-PR pairs on #3230 (#1928/#1931), #2819 (#1936/#1940), #3481 (#1929/#1930) -- each duplicate cluster is a genuinely independent, complete build attempt by a fresh delivery agent dispatched while an earlier one for the same item was still alive but its in-session guard entry had been lost. The #3403 fix adds a DURABLE floor: durableBuildNums(liveAgentSessions) reads real claude agents --json session names (conveyor-<num>, the exact grammar sessionSlugFor(num,'build') mints) and unions a synthetic guard for every num with a live BUILD session into the in-flight guard set BEFORE filtering plan.launch, so a restart-wiped or lost in-session guard can never cause a re-launch while the real OS process is still alive -- the guard clears itself naturally once claude agents --json stops listing the session. A documented follow-up in the same commits also fixes a sticky-spawnedTick bug (the synthesized durable entry used to re-stamp spawnedTick to the CURRENT tick every time, so its age could never reach the TTL and the status line's 'building' count could inflate permanently) via a countableBuildGuards filter that excludes an aged-out unclaimed durable entry from the DISPLAYED tally only, never from the actual double-dispatch suppression.

## Done when

1. **Executable** — `we:scripts/conveyor/__tests__/tick-core.test.mjs`'s new `durableBuildNums` suite and the
   `#3403`/`#3403 FOLLOW-UP`/`#3398` cases in the `planTick` describe block all pass (ported verbatim from
   `origin/lane/mechanical-dispatcher`, commits `b45e1b8c4`/`7d1b53b42`) — they fail on `main` before this
   item lands (no `durableBuildNums` export) and pass after.
2. `we:scripts/conveyor/tick-core.mjs` exports `durableBuildNums` and `computeTickCounts`, and `planTick`
   accepts `liveAgentSessions` and unions a durable guard for every live `conveyor-<num>` session into the
   in-flight build guard BEFORE `filterLaunches`, with the sticky-`spawnedTick` fix (reusing the prior tick's
   own durable entry rather than re-stamping the current tick every time).
3. `we:scripts/conveyor/tick-core.mjs`'s own `main()` IO shell reads `claude agents --json` (via
   `defaultListAgents`) and feeds `liveAgentSessions` into `planTick`, fail-soft (`[]`) on any read error.
4. No regression in the full existing `we:scripts/conveyor/__tests__/tick-core.test.mjs` suite.
5. Explicitly OUT OF SCOPE: `we:skills-src/conveyor/runner.mjs` needs NO change for this item —
   `liveAgentSessions` is gathered entirely inside `we:scripts/conveyor/tick-core.mjs`'s own `main()`, not
   threaded through the runner's stdin payload. Do not fold in `we:skills-src/conveyor/runner.mjs`'s separate,
   much larger unwired diff (verify-dispatch/heartbeat plumbing) — that is its own follow-on.
