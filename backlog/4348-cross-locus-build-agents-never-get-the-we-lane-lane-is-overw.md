---
bornAs: x1qxgif
kind: story
size: 3
priority: high
tier: pinned
rank: i
status: open
scaffoldedBy: "investigate-dispatch-noop-lane-3-d65b5d9a"
dateScaffolded: "2026-09-28"
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/codex-delivery-provider.mjs", "we:scripts/operations/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-28"
tags: ["build-dispatch", "blocker"]
---

# Cross-locus build agents never get the WE lane: LANE is overwritten with the impl lane, so the spec is unreachable

Every mechanical build of a plateau-app/frontierui-scoped card ends in about a minute as `not-ready`, with no commits. The wrapper acquires a WE lane (where `backlog/<spec>.md` lives) and an implementation lane. But it hands the agent only the implementation lane. `buildDeliveryAgentEnv` sets `LANE` to `lanePath`, and for a cross-locus item `lanePath` is the impl-lane override, so `LANE` and `IMPL_LANE` hold the same path. The brief (`we:skills-src/conveyor/delivery-agent-brief-v2.md` L51, L160-167) says `$LANE` is the WE lane that holds the spec. Codex's sandbox is also rooted only at the cwd (the impl lane). The agent cannot find its spec, so it reports `blocked`. The fix: give the agent both lanes, correctly named.

## Evidence (2026-09-28, live)

- Build-daemon tick 14:08:01Z dispatched #3604 (WE lane 2) and #2720 (WE lane 7). Both run records hold effect `status: in-flight`, `route: detached`, `executor: codex`, handles `pid:20516` / `pid:24393` (`~/workspace/.operations/coordination/build-dispatch-runs/dispatch-lane-{78da7085…,28754b06…}.json`).
- Wrapper log `wev-control/.operations/delivery-dispatch-logs/conveyor-2720.log`: acquired WE lane-7, then plateau-app lane-2, then `deliver-item-run: #2720 finished — not-ready (Required specification backlog/2720-….md is missing from the supplied lane; no backlog directory or separate spec lane was provided…)`. #3604 has the same outcome in `conveyor-3604.log`, with plateau-app lane-1.
- Codex rollout `~/.codex/sessions/2026/09/28/rollout-2026-09-28T10-08-47-01a0e858-….jsonl`: `cwd` and `runtime_workspace_roots` are only `…/.lanes/plateau-app/lane-2`. `ls -la backlog` gives `No such file or directory`. `printenv LANE` gives `…/.lanes/plateau-app/lane-2`, the impl lane and not WE lane 7.
- Code, in `we:scripts/operations/deliver-item-wrapper.mjs`: L1085 `const lanePath = lanePathOverride || resolveLane(lane)`, then L1094-1096 `buildDeliveryAgentEnv({ lanePath, …, implLane: lanePathOverride })`, then L889 `LANE: lanePath` and L892 `IMPL_LANE: implLane`. Both env vars get the same value. The Claude provider has the same code (L963, L992-994).
- The locus fix (#2818) did its part. The plateau-app impl lane WAS acquired. The failure is only in what the agent is told.
- The GitHub GraphQL budget ran out at about 14:10Z. It is NOT a factor: the `already-done` gate recorded `checked: true` at 14:08:01Z, and both agents had already exited (14:05 and 14:09) before the backoff.

## Scope

- `buildDeliveryAgentEnv`: `LANE` = the WE lane path (`resolveLanePath(lane)`), and `IMPL_LANE` = the impl lane. Only a cross-locus item sets `IMPL_LANE`.
- Codex provider: the sandbox must be able to read the WE lane. Either add it as a second writable/readable root in `buildCodexDeliveryArgv`'s permission profile, or stage the spec file into the impl lane before spawn. Pick whichever the locked profile supports; the header says `:workspace` extends only from cwd.
- Claude provider: pass the WE lane as an extra working directory (for example `--add-dir`) so `--restricted` file tools can read it.
- Report-dir resolution and the gate stay on the impl lane (no behaviour change there).

## Risks

- Opening the WE lane to a Codex sandbox widens its write surface. Prefer read-only for the WE lane unless the brief truly needs WE-side writes (bookkeeping/`## Progress`).
- The deny-map (`assertDenyPathsUsable`) must still seal both repos' primary checkouts.

## Done when

1. **Executable** — a new case in `we:scripts/operations/deliver-item-wrapper.test.mjs`: for a `plateau-app:`-scoped item with WE lane `L7` and impl lane `P2`, both `CODEX_PROVIDER.spawn` and `CLAUDE_RESTRICTED_PROVIDER.spawn` hand the child `LANE=L7`, `IMPL_LANE=P2`, `cwd=P2`, and a sandbox/dir grant that includes `L7`. This fails on today's main (`LANE=P2`) and passes after.
2. A WE-locus item is unchanged: `LANE` = the WE lane, no `IMPL_LANE`, same argv (existing exact-shape tests stay green).
3. **Live proof** — the build daemon dispatches a real plateau-app card (for example #3604 or #2720, codex-marked), and then:
   - the codex rollout's `runtime_workspace_roots` (or the Claude transcript) shows the WE lane is reachable;
   - the agent reads the spec;
   - the wrapper log does not end in `not-ready (…missing from the supplied lane…)`;
   - commits land in the plateau-app impl lane;
   - a PR opens.

   Attach before/after log lines.
