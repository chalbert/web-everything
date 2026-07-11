---
kind: story
size: 8
parent: "2445"
status: open
dateOpened: "2026-07-11"
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
