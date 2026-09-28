---
bornAs: x000pcl
kind: story
size: 3
status: open
scope: ["we:skills-src/conveyor/delivery-agent-brief-v2.md", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/verify-lane.mjs", "we:scripts/lib/verify-lane-gate.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Workers run affected tests while working, the full gate once after the final commit

Evidence: a daemon-fix worker (fix procedure + #2811 unstick) spent 19 of 48 minutes in 13 full-suite verify runs. we:scripts/verify-lane.mjs already has a diff-driven default gate (we:scripts/lib/verify-lane-gate.mjs, #3372) and a run mode that skips the marker, and we:skills-src/conveyor/fix-agent-brief.md / we:skills-src/conveyor/fix-agent-ci-brief.md already point their mid-work {{GATE_COMMAND}} step at it — but the generic build/delivery briefs (we:skills-src/conveyor/delivery-agent-brief-v2.md, we:skills-src/conveyor/delivery-agent-brief.md) have no equivalent targeted mid-work step, so a worker iterating mid-task has nothing sanctioned narrower than a full suite. Give the generic worker/fixer briefs a targeted mid-work check (vitest related on the touch-set, mirroring the fix brief's GATE_COMMAND pattern) and confirm the terminal we:scripts/verify-lane.mjs request/check sequence is the ONLY full-suite run, once, after the final commit.

## Amendment 2026-09-28 (operator ruling) — the terminal gate is NOT a full-suite run either

**Correction to this item's own title/framing.** "The full gate once after the final commit" described the
ORIGINAL intent, but is no longer the ruled policy: the terminal `we:scripts/verify-lane.mjs` gate that marks a
lane `verified` — read by `we:scripts/pr-land.mjs`'s finish-guard (#3321) before a lane may land — runs the SAME
diff-driven selected tests + scoped `check:standards` as the mid-work check, never the unscoped full
`npm run test:unit && npm run check:standards`, by default. **GitHub CI's required, sharded `test` job is the
ONLY full-suite run** a landing PR depends on. A full local run remains available, but strictly as an explicit
`--gate=` opt-in (e.g. for a checkout CI cannot reach), never the terminal gate's default.

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
path at all — an explicit `--gate=` override somewhere in its dispatch path, or a diff that legitimately hit
`we:scripts/lib/verify-lane-gate.mjs`'s own stated full-suite-fallback triggers (`backlog/`, a
gate-self/policy-core path, package/lockfile, `*.config.*`, shared test helpers/fixtures, a deleted source
file). Add this as a task for whichever session implements this item's remaining (unamended) scope:

## Done when

1. **Executable** — a targeted mid-work check step exists in both
   we:skills-src/conveyor/delivery-agent-brief-v2.md and we:skills-src/conveyor/delivery-agent-brief.md,
   mirroring we:skills-src/conveyor/fix-agent-brief.md's GATE_COMMAND pattern (`grep` for it fails before this
   item lands and finds it after).
2. **Live proof** — a real mid-task iteration on a generic (non-fix) delivery lane shows the targeted check
   running instead of a full-suite run, with the elapsed time recorded before/after.
3. **Executable** — for the open follow-up above: confirm (via a real read of lane-16's actual dispatch path
   and diff, not a guess) whether an explicit `--gate=` override or a stated fallback trigger explains its
   full-suite run, and record the finding in this item.
