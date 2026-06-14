---
type: review
workItem: story
size: 5
status: open
crossRef: { url: /backlog/578-fix-loop-git-integration-bot-pr-mechanics-flow-forge-auth-ag/, label: "#578 — the ruling that motivated this sweep" }
dateOpened: "2026-06-14"
tags: [standards-hygiene, fork-existence-test, support-all-coherent]
---

# Fork-existence-test sweep — find single-solution mandates that leaked into the WE standard

Audit the WE standard for anything leaked in as a MANDATED single solution where the fork-existence test — the lens that dissolved #578's Fork 1 (a false either/or → a support-all credential-source provider seam) — says it must be a provider registry / open config / config-extends-platform-default instead. Sweep blocks / intents / plugs / protocols / adapters + capabilityMatrix for hardcoded single-impl locks, restrictive defaults that should be most-permissive, and any pick-one excluding a coherent (non-broken) option. File each violation as a fix item. Anchor: WE mandates nothing; a fork is real only if a branch is broken.

## Why now

#578 ratified the **fork-existence test** in anger: a "fork" (forge auth A-vs-B) that read as a winner-pick
was actually two coherent end-states that **co-exist as a provider seam**, so it was *dissolved*, not
decided. That same failure mode — a single solution mandated where every coherent option should be supported
— can have **leaked into the standard elsewhere**, authored before the test was sharp. This is a one-time
hygiene sweep to catch those.

## The test (the lens to apply)

For every place the standard *fixes a single answer*, ask the codified questions (already in
[backlog-workflow.md](../docs/agent/backlog-workflow.md) → *Standing test* / *fork-is-not-a-prioritization-tool* /
*Config-Extends-Platform-Default* / *Most-flexible-default*):

1. **Is a coherent alternative excluded?** If a competing approach *works* and isn't broken, mandating one is
   a leak → it should be a **provider registry / open set** (every coherent impl supported; precedence +
   degradation the only rules). Cf. #562/#576 bridge registry, #578 forge + credential seams.
2. **Is a default disguised as a mandate?** A "sensible default" baked into the *standard* (not into a
   **platform-config flavor** the project extends) is a leak → **Config-Extends-Platform-Default**: default-less
   core + inherited-extensible setting, the default living in the flavor.
3. **Is the default the most-permissive value?** Where a dimension has a default, the restriction must be the
   author's opt-in, not the platform's floor (*Most-flexible-default*).
4. **Is it actually a forced invariant?** Exactly-one-correct because the alternative is *flawed* (e.g. a
   security/correctness rule) is **legitimate** — record it as a ratified invariant, not a finding.

## Scope (where to look)

- `src/_data/*.json` registries: `intents.json`, `protocols.json`, `adapters.json`, `capabilityMatrix.json`,
  block/plug definitions — any single-valued field that reads as "the standard says X" where X is one of
  several coherent options.
- Block / intent / plug / protocol / adapter authored docs (`src/**`) asserting one impl/strategy/format.
- Convention surfaces already folded into compliance (#436/#437/#579) — confirm they're *vocabulary the
  project extends*, not standard mandates.

## Deliverable

- A `reports/{date}-fork-existence-test-sweep.md` findings report: each candidate leak with its location
  (`file:line`), which test question it fails, and the recommended reshape (registry / open config /
  most-permissive default / or "legitimate invariant — no action").
- **File each real violation as its own fix item** (per *Closing out*), `blockedBy` this sweep where the fix
  is a reshape. A clean sweep (no leaks) is a valid, reportable outcome — say so explicitly.
- This is a **finder + classifier**, not the fixer: the reshapes are separate prioritized builds.
