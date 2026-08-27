---
bornAs: xyp1wnt
kind: story
size: 3
parent: "3369"
status: open
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/operations/cli-adapter.mjs"]
dateOpened: "2026-08-27"
tags: [operations, multi-provider, refactor]
---

# Extract the provider port from the judge-spawn seam

`createDefaultJudge` (`we:scripts/operations/cli-adapter.mjs:464`) is the only place in the repo that wires
the engine's provider-neutral `judge(request) → outcome` contract to a specific CLI (`judgeSpawn`, which
hardcodes `JUDGE_CLI = 'claude'`). Both already take an injected `spawn`/`spawnFn` for testing. This item
names that seam as a real provider port — a stable shape a second implementation can satisfy — without
building or choosing a second provider yet. Behaviour is unchanged; Claude remains the only implementation.

## Done when

1. **Executable** — a test constructs `createDefaultJudge` with a hand-written fake implementing the port
   shape (not the existing `withFakeClaude`/CLI-shaped stub) and asserts it is accepted and driven the same
   way the real spawner is. It must fail against `main`, because no such port-shaped contract exists to
   satisfy today — only a CLI-argv-shaped stub does.
2. **The port is named and documented as a boundary**, not just an inferred function signature: what a
   provider implementation receives (the `judge` request shape already used by the engine) and what it must
   return (the outcome shape `parseJudgeOutcome` produces today), independent of any CLI's argv or stdout
   format.
3. **`judgeSpawn` becomes ONE implementation of the port**, not the port itself. Its Claude-specific argv
   construction (`buildJudgeArgv`) and stdout parsing (`parseJudgeOutcome`) stay exactly where they are —
   this item does not touch what they do, only what sits between them and `createDefaultJudge`.
4. **No behavioural change** — every existing test in `we:scripts/lib/__tests__/judge-spawn.test.mjs` and
   `we:scripts/operations/__tests__/cli-adapter*.test.mjs` passes unmodified, or is touched only where the
   port extraction requires a mechanical rename.

## Deliberately NOT in scope

- **A second provider implementation.** That is `#3371`, which is blocked on this item landing first —
  there is no port to implement against otherwise.
- **The dispatcher/panelist spawn sites** (`we:scripts/operations/dispatch-lane-io.mjs`,
  `we:scripts/operations/explore-io.mjs`). Judges are the lowest-risk boundary because they are tool-free by
  default and already speak a neutral contract at the engine layer; the harder sites wait for the epic's
  later steps.

## Lineage

First decomposition step of `#3369` (multi-provider agent dispatch), filed 2026-08-27.
