---
bornAs: x000pcl
kind: story
size: 3
status: resolved
scope: ["we:skills-src/conveyor/delivery-agent-brief-v2.md", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/verify-lane.mjs", "we:scripts/lib/verify-lane-gate.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
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

## Progress (2026-09-28, delivery build)

### Converge (step 6)

Ran `/converge` (`care=elevated`) against the lane's real diff. Round 1's panel (correctness, security,
simplicity, standards-conformance, claim-accuracy) surfaced two real, cheap-to-fix issues, both fixed in this
same diff before red-team: the documented mid-work command was missing `--run --passWithNoTests` (now added,
matching the live-proof command and the guard test), and a timing claim ("two orders of magnitude" / "~14
minutes") was imprecise (now "~15–35×" / "~80×" against the actual `.lane-verify` timestamps). A second panel
pass on the corrected diff came back clean except one cosmetic simplicity carve-out (the mid-work paragraph
carries guard-internals rationale a dispatched agent doesn't strictly need — left as-is, consistent with this
brief's existing dense, issue-linked style elsewhere). The red-team round (same five lenses) found no blocker —
every finding was `worseThanBase: false` / `parallelizable: true`, i.e. a carve-out, not a break — but converged
on one recurring, genuinely useful idea across four of the five lenses: nothing mechanically ties the brief's
documented command to the guard test that defends it, so the two can drift silently. Filed as **#x3zp8nf**
(`we:backlog/x3zp8nf-assert-the-delivery-brief-s-mid-work-command-against-the-gua.md`) rather than built here —
it is a real coverage gap, not a blocker on this item's own Done-when. **Verdict: `land`** — accept on every
lens, red-team failed to break it.

### Done-when 1 — mid-work step added to the live brief

Added a **"Mid-work check"** block to `we:skills-src/conveyor/delivery-agent-brief.md`, inside step 4 ("Build it
to spec"), right before step 5's terminal gate:

```bash
node scripts/readiness/heavy-admission.mjs run -- npx vitest related <touched-file-1> <touched-file-2> … --run --passWithNoTests
```

This is the **admitted-wrapper** shape (`ADMISSION_WRAPPER_HEAD` in `we:scripts/guard-bash.mjs`) — its head is
`node we:scripts/readiness/heavy-admission.mjs run`, never a raw `npx vitest …` head, so `isHeavyRawRun`/`isVerificationRun` both read
`false` for it and `dispatchedAgentVerificationReason` never fires, unlike a bare `we:scripts/verify-lane.mjs
run` (the Codex-flagged gap in the fix briefs' own `GATE_COMMAND`, which IS denied — see "Left for follow-up"
below). Confirmed both halves of Done-when 1:

- **Grep before/after**:
  ```bash
  grep -c "heavy-admission.mjs run -- npx vitest related" we:skills-src/conveyor/delivery-agent-brief.md
  ```
  → `0` at this item's base commit, `1` after this change.
- **Guard non-denial**: added a new test to `we:scripts/__tests__/guard-bash.test.mjs` — *"the admitted wrapper
  form of a targeted `vitest related` is NOT denied to a dispatched agent, any kind"* — asserting
  `dispatchedAgentVerificationReason(cmd, kind)` is `null` for `kind` in `build`/`fix`/`ci-heal` for exactly the
  command shape the brief now documents. This sits alongside the pre-existing sibling test for the `vitest run`
  spelling, which already proved the same exemption for that variant.

### Done-when 2 — v2 explicitly EXCLUDED from this item's scope (design call)

`we:skills-src/conveyor/delivery-agent-brief-v2.md` is a non-live PROTOTYPE whose entire design premise is that
**the agent never runs any gate command itself, in any form** — not the terminal gate, and not a mid-work one
either. Per its own text: *"Do NOT run `git commit`… do not run any gate command yourself. The wrapper does all
of that once you report."* The only verification touchpoint in v2 is the wrapper running the gate once, after
the agent's single `done` report, with the wrapper resuming the agent only if that comes back red.

There is no mid-work iteration loop in v2 for a step like this to attach to — the agent does not iterate against
its own gate feedback at all under v2; it builds once, reports once, and the wrapper owns everything gate-shaped
from there. Adding a "run this targeted check yourself while you work" step would reintroduce exactly the
direct-gate-running v2's cutover exists to remove, defeating the design it is prototyping. **Decision: v2 is
explicitly excluded from this item's scope.** No change is made to
`we:skills-src/conveyor/delivery-agent-brief-v2.md`.

### Done-when 3 — live proof (this very build, a generic non-fix delivery lane)

This delivery agent IS a generic (non-fix) delivery lane running `we:skills-src/conveyor/delivery-agent-brief.md`
verbatim — so the mid-work iteration was run for real, on this item's own touch-set, mid-task:

```
node scripts/readiness/heavy-admission.mjs run -- npx vitest related scripts/__tests__/guard-bash.test.mjs --run --passWithNoTests
  → Test Files  1 passed (1) / Tests  900 passed (900) — wall time ~10.1s
```

(A second run against the more widely-imported `we:scripts/guard-bash.mjs` + its test file pulled in 126 of the
repo's 756 test files — still a real shrink — in ~66s wall time.)

**Before/after**: this brief's own step 5 documents the terminal full gate at **150–350s** (roughly **15–35×**
the 10.1s targeted run), and this item's own Amendment section above already recorded lane-16's REAL full-suite
run at **~13.5 minutes / ~808s** (18:24:32.838Z–18:38:00.348Z, `.lane-verify` marker quoted just below — roughly
**80×** the targeted run). Either way, a live, not merely theoretical, demonstration of the targeted step doing
its job.

### Done-when 4 — lane-16 root-caused: the selector's own SOUND fallback, not a caller default

Read lane-16's actual `.lane-verify` marker (`<lane>/.git/.lane-verify`) rather than any downstream `--gate=`
value:

```json
{
  "sha": "663762a27fcec0cc8893420a50074557d636132c",
  "status": "red",
  "startedAt": "2026-09-28T18:24:32.838Z",
  "finishedAt": "2026-09-28T18:38:00.348Z",
  "suites": "npm run test:unit && npm run check:standards"
}
```

That `sha` is a real merge commit still present in the lane-16 clone's object store (`git cat-file -t` resolves
it): *"Merge origin/main into lane/4309-gate-red-recovered work"*, i.e. lane-16 was building **#4309** (a
GitHub-API budget queue). Reconstructing the ACTUAL diff `decideLocalSelection` would have seen — the net
changed set against the pinned merge-base (`git merge-base origin/main <sha>` → the second parent,
`999c22e3d…`; `git diff --name-only <mergeBase> <sha>`) — gives the real 17-file touch-set for #4309, including
six newly-**added** files:

```
A  scripts/lib/__tests__/fixtures/gh-debug/api-rate-limit-rest.debug.stderr
A  scripts/lib/__tests__/fixtures/gh-debug/pr-list-paginated.debug.stderr
A  scripts/lib/__tests__/fixtures/gh-debug/pr-view-404.debug.stderr
A  scripts/lib/__tests__/fixtures/gh-debug/pr-view-404.plain.stderr
A  scripts/lib/__tests__/fixtures/gh-debug/pr-view-git-resolve.debug.stderr
A  scripts/lib/__tests__/fixtures/gh-debug/pr-view-success.debug.stderr
```

`we:scripts/readiness/test-selection.mjs#isLocalFullSuiteTrigger` flags a path as a full-suite trigger when
`SHARED_TEST_DIRS` (`/(^|\/)(__tests__|__fixtures__|__mocks__|test-utils|test-helpers)\//`) matches AND the path
is not itself a test file. Each of the six new fixtures lives under `scripts/lib/__tests__/fixtures/gh-debug/` —
inside a `__tests__/` directory component — and is a `.debug.stderr`/`.plain.stderr` data file, not a
`*.test.*`/`*.spec.*` file, so every one of them independently matched the trigger (confirmed by running the
actual regexes from `we:scripts/readiness/test-selection.mjs` against these exact paths). That forced
`decideLocalSelection` to `mode: 'full'` with reason *"config / setup / dependency / shared-test-helper file(s)
changed… the module graph cannot scope these"* — the full suite ran because the selector correctly could not
trace which tests consume opaque fixture data added under a `__tests__/` tree, not because any caller
configured or defaulted to `full`.

**Verdict: the selector's own sound, deliberate fallback — NOT a violation of the amendment's ruling**, exactly
the Codex-review-flagged class of case ("the selector correctly declining to guess on a diff shape it cannot
narrow"). Nothing in `we:scripts/lib/verify-lane-gate.mjs`/`we:scripts/readiness/test-selection.mjs` needs to
change for this instance; #4309's own full-suite run mid-task was the sound, intended behavior given what it
actually changed.

### Left for follow-up (not built here — kept out to avoid scope creep on this item)

While root-causing Done-when 1's Codex correction, confirmed that `we:skills-src/conveyor/fix-agent-brief.md`'s
own `{{GATE_COMMAND}}` resolves to `we:scripts/verify-lane.mjs run --repo=.` — a bare `run` invocation, the exact
shape `we:scripts/guard-bash.mjs#dispatchedAgentVerificationReason` denies for a mechanically-dispatched `fix`
agent (only `request`/`check`/`reset` are exempt). This item's own scope and Done-when never named the fix
briefs' `GATE_COMMAND` itself as something to change (only "mirroring" it as inspiration for the generic briefs'
new step, which Done-when 1 explicitly redirects to a guard-permitted shape instead) — fixing the fix briefs' own
pre-existing gap is a separate, real bug worth its own card rather than folding into this one's diff. Filed as
**#x89yzuj** (`we:backlog/x89yzuj-fix-briefs-mid-work-gate-command-is-a-bare-verify-lane-invoc.md`).
