---
bornAs: x000pcl
kind: story
size: 3
status: open
scope: ["we:skills-src/conveyor/delivery-agent-brief-v2.md", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/verify-lane.mjs", "we:scripts/lib/verify-lane-gate.mjs"]
dateOpened: "2026-09-27"
preparedDate: "2026-09-28"
preparedAgainstSha: "d0ca633fdd77999f8e9ac61e0ee330544ab494eb"
tags: []
---

# Workers run affected tests while working, the full gate once after the final commit

Evidence: a daemon-fix worker (fix procedure + #2811 unstick) spent 19 of 48 minutes in 13 full-suite verify runs. we:scripts/verify-lane.mjs already has a diff-driven default gate (we:scripts/lib/verify-lane-gate.mjs, #3372) and a run mode that skips the marker, and we:skills-src/conveyor/fix-agent-brief.md / we:skills-src/conveyor/fix-agent-ci-brief.md already point their mid-work {{GATE_COMMAND}} step at it — but the generic build/delivery briefs (we:skills-src/conveyor/delivery-agent-brief-v2.md, we:skills-src/conveyor/delivery-agent-brief.md) have no equivalent targeted mid-work step, so a worker iterating mid-task has nothing sanctioned narrower than a full suite. Give the generic worker/fixer briefs a targeted mid-work check (vitest related on the touch-set, mirroring the fix brief's GATE_COMMAND pattern) and confirm the terminal we:scripts/verify-lane.mjs request/check sequence is the ONLY full-suite run, once, after the final commit.

## Amendment 2026-09-28 (operator ruling) — the terminal gate is NOT a full-suite run either

**Correction to this item's own title/framing.** "The full gate once after the final commit" described the
ORIGINAL intent, but is no longer the ruled policy: the terminal `we:scripts/verify-lane.mjs` gate that marks a
lane `verified` — read by `we:scripts/pr-land.mjs`'s finish-guard (#3321) before a lane may land — must never be
pointed, by a caller's own explicit configuration, at the unscoped full `npm run test:unit && npm run
check:standards` as its default. **GitHub CI's required, sharded `test` job remains the sole full-suite
AUTHORITY** a landing PR depends on. A full local run remains available as a deliberate override (e.g. for a
checkout CI cannot reach), never a caller's default configuration.

**Live evidence for the correction, same day (2026-09-28):** lane-16's verify ran the full
`npm run test:unit && npm run check:standards` (~15–20 minutes under load) while lane-13's ran the diff-driven
`vitest related` selection on a comparable change — three delivery agents sat roughly 45 minutes total waiting
on the resulting serial verify runs. **Rationale for why the terminal gate can safely stop being "the full
suite, once"**: draft-first PRs (#2813) now keep a red-CI PR out of review before a human ever looks at it,
which is exactly what #3321's original local-green-before-land requirement existed to protect against — so CI,
not the local gate, is now the backstop that makes a full local run unnecessary as the default.

Codified as a statute anchor:
[we:docs/agent/platform-decisions.md#local-gate-never-full-suite-by-default](platform-decisions.md#local-gate-never-full-suite-by-default).
This item's own original scope (a targeted mid-work step for the generic build/delivery briefs) is UNCHANGED
and still open — the amendment only corrects what the TERMINAL gate itself was assumed to run.

**Open follow-up, not settled by this amendment:** why lane-16's terminal verify took the unscoped full-suite
path at all. Task 4, below, is where this gets root-caused for real.

## Codex review correction (folded 2026-09-28)

A read-only Codex plan review (`node we:scripts/codex-direct-task.mjs --review`) over this amendment found the
above initially conflated two different mechanisms, and found real gaps in the original (unamended) scope's own
plan. Folded corrections:

- **The vitest-half full-suite fallback is NOT `backlog/`/gate-self/policy-core.** Those paths only force the
  *check:standards* half unscoped (`we:scripts/lib/verify-lane-gate.mjs#canScopeCheckStandards`). The vitest
  half's own automatic full-suite fallback is a SEPARATE, already-sound mechanism —
  `we:scripts/readiness/test-selection.mjs#decideLocalSelection` falls back to full on a config/dependency/
  shared-test-helper-file change, a deleted source file, an empty/unreadable diff, or `WE_DIFF_TEST_SELECTION=0`
  — and `we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate`/`composeGate` also defaults to a bare full
  command for a checkout with no `test:unit` script. **None of this is a violation of the amendment's rule** —
  it is the selector correctly declining to guess on a diff shape it cannot narrow. The rule this amendment
  records targets a CALLER choosing the full suite as its own default configuration, never this automatic,
  sound fallback. The statute anchor has been corrected to state this distinction explicitly.
- **A dispatcher `--gate=` argument is not itself proof of a deliberate operator opt-in.** `request` resolves
  the DEFAULT command (which may itself have resolved to `full`, per the fallback above) and saves it as
  `marker.suites`; `we:scripts/conveyor/verify-dispatch.mjs` then forwards that resolved value as `--gate=`
  downstream. So an automatically-selected full fallback can look, several hops later, like "an explicit
  override" even though no caller ever deliberately asked for one. **Task 4 (below) must trace lane-16's run
  back to the ORIGINAL selection inputs (the actual diff `decideLocalSelection` saw), not stop at whatever
  `--gate=` value shows up downstream.**
- **Mirroring the fix brief's `GATE_COMMAND` pattern hits an unaddressed execution constraint.** Its command is
  `we:scripts/verify-lane.mjs run`, but `we:scripts/guard-bash.mjs` denies that direct invocation for dispatched
  build agents (only `request`/`check`/`reset` are on the allowlist). A generic delivery agent copying the fix
  brief's literal pattern would be denied by the guard — the original scope's Done-when item 1 needs a command
  shape the guard actually permits (or a guard-allowlist change with its own test), not just a successful grep
  over the brief text.
- **`we:skills-src/conveyor/delivery-agent-brief-v2.md` is an explicitly non-live prototype whose own design
  PROHIBITS an agent from running gates itself** (verification is delegated to its wrapper). Adding the same
  mid-work step there, as the original scope names it, needs reconciling with that design first — either the
  step is added in a form consistent with the v2 wrapper owning verification, or v2 is dropped from this item's
  scope with a stated reason, not silently mirrored from the v1 brief.

## Risks

- **Missing from the original scope:** unknown/empty-diff behavior for the new mid-work step (what a targeted
  check does when the touch-set is too fresh/unstaged for `vitest related` to resolve), and the two fix briefs'
  (`we:skills-src/conveyor/fix-agent-brief.md`, `we:skills-src/conveyor/fix-agent-ci-brief.md`) own
  `GATE_COMMAND` instructions potentially drifting out of sync with whatever pattern this item lands for the
  generic briefs.

## Done when

1. **Executable** — a targeted mid-work check step exists in `we:skills-src/conveyor/delivery-agent-brief.md`,
   using a command shape `we:scripts/guard-bash.mjs`'s dispatched-agent allowlist actually permits (not a bare
   `we:verify-lane.mjs run` copy-paste) — `grep` for it fails before this item lands and finds it after, AND a real
   dispatched-agent invocation of that command is not denied by the guard.
2. **Executable** — `we:skills-src/conveyor/delivery-agent-brief-v2.md` either gains the equivalent step in a
   form consistent with its wrapper-owns-verification design, or is explicitly excluded from this item's scope
   with the reason recorded here (a design call the implementing session must make, not silently skip).
3. **Live proof** — a real mid-task iteration on a generic (non-fix) delivery lane shows the targeted check
   running instead of a full-suite run, with the elapsed time recorded before/after.
4. **Executable** — root-cause lane-16's full-suite run by reading its ACTUAL dispatch path and the ACTUAL diff
   `decideLocalSelection` saw at request time (not the downstream `--gate=` value alone, per the Codex
   correction above) — record whether it was a caller default (this ruling's real target) or the selector's own
   sound fallback (not a violation), in this item.
