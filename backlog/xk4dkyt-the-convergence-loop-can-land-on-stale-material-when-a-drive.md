---
kind: story
size: 3
status: open
relatedTo: ["2965", "2971", "2970"]
scope: ["we:scripts/lib/converge-core.mjs", "we:scripts/converge-cli.mjs"]
dateOpened: "2026-08-07"
tags: [converge, gate, fail-closed]
---

# The convergence loop can LAND on stale material when a driver omits lensResults

A driver that reports `editResult` without re-sending `lensResults` does not get the refusal the module
promises — it gets a fresh panel seeded with the **pre-edit** material, and that panel can carry all the
way to `action: land`, `verdict: accept`. The loop then reports a converged accept over material nobody
judged, with the previous round's findings never re-confirmed. `we:scripts/converge-cli.mjs` states the
opposite in its own header: *"the core reads whatever is absent as 'did not happen', which is why a
malformed caller degrades to an escalation rather than to a land."* On this input shape it degrades to a
land. Found red-teaming the PR #1064 review; reproduced end to end.

## The reproduction

Driven against a real lane clone at `--care=elevated`:

1. `init` → `read`.
2. `step {"round":1,"readResult":{"material":"AAA"}}` → `panel`, each mandate fenced with `AAA`.
3. `step` with round-1 `lensResults` carrying a `security` finding → `edit`, round still 1.
4. `step {"round":1,"editResult":{"advanced":true}}` — **no `lensResults`** → `panel`, round 1, material
   still `AAA`. `editResult` is ignored entirely, not even echoed.
5. A clean `lensResults` against that stale panel → `red-team`, `verdict: accept`, `outcome: land`.
6. A clean `redTeamResult` → **`action: land`, `verdict: accept`, round 1.**

The edited material was never read or judged, and the round-1 `security` finding never re-confirmed.

## Root cause is ordering, not a missing check

In `we:scripts/lib/converge-core.mjs`, `convergeStep` returns the PANEL action on
`if (!obs.panel.observed)` **before** it reaches the round-stamp staleness guard. `obs.panel.observed` is
`false` whenever `lensResults` is absent, whatever `editResult` says — so this shape short-circuits past
the very refusal written for malformed callers. The guard exists and is correct; it is simply unreachable
from here.

## Why this is severity-worthy, not a driver-contract nit

An earlier read of this called it fail-safe — "wasted work, never a false land." That is wrong, and the
reproduction above is why. Two aggravating factors:

- **Panels are non-deterministic.** Re-judging unchanged flawed material is not guaranteed to reproduce
  the finding, so a second look at the same bad diff can pass.
- **`land` is the loop's strongest claim.** It asserts a non-author panel accepted the final material AND
  a red-team failed to break it. Here neither statement is about the final material.

## Shape of the fix

Refuse the shape rather than papering over it in SKILL prose: an `editResult` (or `redTeamResult`)
arriving with no `lensResults` for the current round is a malformed observation and must escalate — most
likely by moving the staleness/observation-consistency check ahead of the `!obs.panel.observed`
short-circuit, so the promised degradation is actually reachable. Whatever the shape, it belongs in the
tested core, not in the driver's instructions.

## Done when

- The step-4 input above escalates instead of returning `panel`.
- A unit test in the core asserts it — the fail-closed claim is currently untested for this input.
- The end-to-end sequence can no longer reach `land` without the post-edit material being read.
- `we:skills-src/converge/SKILL.md`'s action table stays as-is; the core enforces it rather than the prose.
