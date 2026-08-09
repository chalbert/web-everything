---
bornAs: xm881ll
kind: story
size: 2
parent: "3029"
status: open
dateOpened: "2026-08-08"
scope:
  - we:reports/
scopeRationale: "A spike whose only output is one new report; its filename is not known until the spike runs."
tags: [plateau-loop, delivery, operations, spike, dispatch]
---

# Spike — does the background-agent lifecycle cover a dispatch effect?

Two-point spike, **no production code**. Establish whether the command-line tool's background-agent lifecycle
(`--bg`, `claude agents`) already owns start / observe / stop for a long-running lane build. Its answer decides
whether [#3037] needs a fifth step kind, a thin wrapper, or nothing at all.

## Why this is worth two points before the epic commits

Every other slice assumes the four-kind vocabulary from
[#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated),
and the statute is explicit that a fifth kind means the *model* is wrong. `dispatch` is the one operation whose
effect **starts** something that outlives the run by an hour rather than completing — and nothing in `compute` /
`judge` / `confirm` / `effect` describes that.

There are three possible answers and they lead to visibly different builds, which is what makes this a spike and
not a task:

1. **The lifecycle covers it.** Dispatch's effect becomes "start a background agent, record the handle" and the
   run is done. No new kind, and the engine never models a long-running child.
2. **It covers start but not observation or stop.** A thin adapter fills the gap; still no new kind.
3. **It does not fit.** Then the vocabulary genuinely has a hole, and we would rather find that on a two-point
   spike than on the fifth declared operation.

## Questions to answer

- What does `--bg` return, and is the handle stable enough to persist in a run record?
- Can a detached agent be listed, observed and stopped by that handle from a different process — the headless
  runner, not the session that started it?
- What survives a restart of the thing that started it? (This is the property the conveyor actually needs.)
- Does it interact with lane clones and the existing lane lease, or duplicate them?
- Does it satisfy the `spawn / steer / stop / resume / observe` interface
  [#agent-runner-cli-backend](../docs/agent/platform-decisions.md#agent-runner-cli-backend) (#2444) already
  ratified as backend-agnostic? That statute is the prior art here — if `--bg` fills it, answer 1 is the default,
  and if it does not, the gap should be stated against that named interface rather than in fresh words.

## Acceptance

A short report in `we:reports/` recording which of the three answers holds, with the commands run and their real
output pasted in — not a summary. It names the shape [#3037] should be built to, and the epic
[#3029] updates its slice-8 framing to match. If answer 3, it also states plainly what the missing kind would
have to be, so the decision to extend the vocabulary is made deliberately and in the open.
