---
bornAs: xb002dz
kind: story
size: 8
parent: "2445"
status: resolved
dateOpened: "2026-07-11"
dateStarted: "2026-07-12"
dateResolved: "2026-07-12"
graduatedTo: none
tags: [plateau-loop, drain, merge-queue, coordinator]
---

# Ship the phase-1 resident drain daemon — merge queue only

A resident process that owns ONLY the merge queue — leases, blockedBy ordering, review labels, sole-writer drain — hosted provisionally in plateau-app next to the dev-panel. Sessions keep building and reviewing exactly as today; the one convention retired is who runs /drain. No agent spawning, no steering, no UI, no multi-project registry. This is the de-scoped phase 1 from the 2026-07-11 red team: it captures most of the reliability win while producing the evidence the deferred decisions (#2444 agent-runner, #2446 placement) are waiting on.

## Why this scope

The parent epic's reliability evidence — the patch trail (#2391, #2395, the #2424/#2443 double-drain,
#2442's idle poll) — is almost entirely *drain* pain: leases, ordering, sole-writer. Those are pure
state-machine problems a resident owner genuinely fixes. Everything else the epic proposes (agent
spawning, steering, UI, registry, self-hosting) carries the risks the red team flagged — subscription
quota, unstable CLI contracts, crash-recovery complexity — and none of it is needed to fix the observed
failures. This story attacks the proven pain and nothing speculative.

## In scope

- One resident process (launchd/daemonized or a long-lived terminal process — operational shape is part
  of the work) that watches the queue and is the ONLY thing that runs the drain sweep
  ([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) logic, owned in-process).
- In-process leases replacing the whole-process drain lease conventions (#2391, #2424/#2443 absorbed).
- Review-label lifecycle (`ready-to-merge`, `review:*`) driven from the daemon; the `review:human`
  invariant preserved (see the gate-self re-anchoring sibling task).
- Survives laptop sleep/restart by construction: persisted minimal state + idempotent resume (the queue
  itself on GitHub is the source of truth — the daemon must be restart-safe, not crash-proof).

## Out of scope (deliberately)

- Spawning or steering agents (#2444 stays deferred), any UI, the multi-project registry, self-hosting.
- Retiring session conventions beyond "who runs /drain" — mixed mode with interactive sessions is the
  permanent reality; the daemon must co-exist with them, not assume they disappear.

## Evidence it must produce

A few weeks of operation should answer: did drain-class incidents stop; how often did restart-recovery
run; did the extraction want to grow (→ ratify #2446 with data) or was a small resident script the whole
win (→ shrink the parent epic).

## Progress

- **Status:** designing → building
- **Branch:** WE `lane/2449-drain-daemon` (lane-27) + plateau-app lane (impl PR first, WE PR last)
- **Done:** mapped [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) (watch/lease region,
  exports), [we:scripts/readiness/drain-lock.mjs](scripts/readiness/drain-lock.mjs),
  [we:scripts/drain-push-at-close.mjs](scripts/drain-push-at-close.mjs), drain SKILL; surveyed
  plateau-app hosting (`plateau:tools/` + vitest gate + fs-backed state conventions).
- **Design (locked):**
  - `plateau:tools/drain-daemon/` — resident supervisor: holds the whole-process drain lease
    (#2391 primitive, imported from the WE clone — never forked) for its full residency, runs
    `we:scripts/merge-ai-prs.mjs --label=ready-to-merge --json` as ONE-SHOT child passes on an
    interval from a dedicated WE clone (private lane pool `we-drain-daemon`, self-refreshed
    fetch+reset per pass), persists `plateau:.drain-daemon/state.json` + a pass-history journal
    (the operating evidence), launchd LaunchAgent (`install|start|stop|status|once` CLI) for
    sleep/restart survival. No agent spawning: parked PRs (`review:*`) surface in status for
    sessions.
  - `we:scripts/merge-ai-prs.mjs` — whole-process lease becomes ALWAYS-ON for full/label sweeps +
    watches (live foreign holder → no-op exit 0 surfacing the holder; absorbs #2424, ratifies
    #2443 "hold by default"); new `--under-lease=<owner>` for the daemon's children; `--only`
    fast drains bypass the lease (numbering mutex suffices — `/pr`/`/finish` stay instant);
    `--no-drain-lease` escape hatch. Sweep logic stays in `we:scripts/` so gate-self (#2448)
    stays anchored.
  - Mixed mode by construction: daemon resident → push-at-close + interactive full drains no-op on
    its lease; daemon absent → today's behavior exactly.
- **Delivered (2026-07-12):**
  - WE: `decideDrainLeaseGate` + always-on lease wiring in
    [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) (+9 unit tests; the
    [we:scripts/__tests__/drain-push-at-close.test.mjs](scripts/__tests__/drain-push-at-close.test.mjs)
    wiring test updated); drain SKILL + [we:scripts/drain-push-at-close.mjs](scripts/drain-push-at-close.mjs)
    header note the resident owner. #2424 and #2443 resolved as absorbed.
  - plateau-app: `plateau:tools/drain-daemon/` (`plateau:tools/drain-daemon/lib.mjs` pure layer +
    19 vitest tests, `plateau:tools/drain-daemon/daemon.mjs` resident shell,
    `plateau:tools/drain-daemon/cli.mjs` install|uninstall|start|stop|status|once|logs, README),
    vitest include + gitignore entries.
  - Verified live: `once --dry-run` and real `once` swept all 3 repos (PR #440 correctly parked);
    resident run acquired the lease, passed, persisted state/history; while resident an interactive
    full drain AND push-at-close both no-op'd surfacing `Mac:<pid>:drain-daemon`; SIGTERM released
    the lease cleanly. Both repo gates green (WE: check:standards 0 errors + 3182 vitest;
    plateau: 803 vitest incl. the 19 new).
- **Next (operator):** `node plateau:tools/drain-daemon/cli.mjs install` (run from the plateau-app
  checkout) — provisions the dedicated `we-drain-daemon` WE clone and bootstraps the LaunchAgent
  (installing a launchd agent is deliberately left to the operator). Evidence review scaffolded as
  #2456.
- **Notes:** `--only` lease-bypass is deliberate (scoped land, numbering mutex keeps it safe);
  daemon child passes inherit label-lag repoll (#2230) from the one-shot path; gate-self stays
  anchored because ALL sweep logic stays in `we:scripts/` (#2448 remains open and owed).
