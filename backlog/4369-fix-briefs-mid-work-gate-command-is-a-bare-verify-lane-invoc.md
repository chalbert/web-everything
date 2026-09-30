---
bornAs: x89yzuj
kind: story
size: 2
status: active
scope: ["we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-bash.test.mjs", "we:skills-src/conveyor/__tests__/", "we:scripts/verify-lane.mjs", "we:skills-src/batch-backlog-items/parallel-execute.workflow.js"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "b781ee138b012663b7e1f22a38df436f7e35a6b5"
tags: []
---

# Fix briefs' mid-work GATE_COMMAND is a bare verify-lane invocation, denied to a dispatched fix agent

we:skills-src/conveyor/fix-agent-brief.md's GATE_COMMAND resolves to a bare we:scripts/verify-lane.mjs run --repo=. invocation. we:scripts/guard-bash.mjs's dispatchedAgentVerificationReason denies any we:scripts/verify-lane.mjs invocation for a mechanically-dispatched agent except request/check/reset (#3105) — so a fix-kind dispatched agent following this brief literally would be denied by the guard when it reaches this step. Give GATE_COMMAND a guard-permitted shape (the request/check poll pattern, or the admitted we:scripts/readiness/heavy-admission.mjs wrapper — see #4294 Done-when 1 for the pattern this item should mirror), and confirm with a real dispatched-agent invocation (or an equivalent we:scripts/guard-bash.mjs unit test) that the new shape is not denied. Check we:skills-src/conveyor/fix-agent-ci-brief.md for the same GATE_COMMAND pattern and fix it too if present. Discovered 2026-09-28 while building #4294 (out of that item's own Done-when scope, so filed separately rather than folded in).

## Done when

1. **Executable** — `we:skills-src/conveyor/fix-agent-brief.md`'s `{{GATE_COMMAND}}` no longer resolves to a
   bare `we:scripts/verify-lane.mjs run` (or any other shape `we:scripts/guard-bash.mjs`'s
   `dispatchedAgentVerificationReason` denies for a `fix`-dispatched agent) — a new/updated
   `we:scripts/__tests__/guard-bash.test.mjs` test asserts the exact resolved command shape is not denied for
   `dispatchedAgentVerificationReason(cmd, 'fix')`, mirroring the sibling proof #4294 added for the generic
   delivery brief's own mid-work step.
2. **Executable** — `we:skills-src/conveyor/fix-agent-ci-brief.md` is checked for the same `{{GATE_COMMAND}}`
   pattern; if present, it gets the identical fix in the same PR (not deferred to yet another item).
3. **Edge case named** — cover the case where the resolved command must still surface a genuinely RED gate to
   the fix agent (this brief's whole job is repairing a red PR) — the new shape must not silently swallow a red
   result the way a mid-work-only targeted check is allowed to; state explicitly whether the fix brief's
   terminal gate step needs the same request/check split the generic brief's step 5 already uses, or a
   different treatment, and why.

## Design

**Premise check (against `main` @ b781ee138): real and still open.** `gateFor` returns
`node we:scripts/verify-lane.mjs run --repo=.` (`we:scripts/lib/repo-profile.mjs:151-155`), which fills
`{{GATE_COMMAND}}` in both `we:skills-src/conveyor/fix-agent-brief.md:335` and
`we:skills-src/conveyor/fix-agent-ci-brief.md:285`. Probed live with `dispatchedAgentVerificationReason` /
`decide(cmd, {dispatchKind:'fix'})` on this checkout: that exact command is **DENIED** for `fix` and `ci-heal`
(`SANCTIONED_VERIFY_LANE_QUERY` at `we:scripts/guard-bash.mjs` allows only `request|check|reset`). **Wrapping it does
not help:** `we:scripts/readiness/heavy-admission.mjs run -- we:scripts/verify-lane.mjs run --repo=.` is also DENIED, because
`VERIFICATION_RUN` matches the `we:scripts/verify-lane.mjs` operand anywhere in the command. Only `we:scripts/verify-lane.mjs request` and
`check [--wait=<ms>]` are allowed. So #4294's admitted-wrapper pattern (a mid-work `vitest related`) cannot be the
TERMINAL gate — it can't include `check:standards`, and a wrapped whole-suite run is denied too. The fix agent's
terminal gate must be the **request/check split** the generic delivery brief's step 5 already uses
(`we:skills-src/conveyor/delivery-agent-brief.md` "You cannot run the gate yourself").

**Mechanism (revised after adversarial review).**
1. **Leave `gateFor` returning `run`.** It has other real consumers that need the synchronous `run` form and its
   green line: the canary (`we:scripts/conveyor/canary.mjs:164,180` → `we:skills-src/conveyor/canary-agent-brief.md:54-60`,
   `GATE_GREEN_RE` in `we:scripts/conveyor/canary-stages.mjs:124-129`, its contract test
   `we:scripts/conveyor/__tests__/canary-stages.test.mjs:182-187`), `we:scripts/conveyor/pr-work-unit.mjs:118`, and pinning tests
   (`we:scripts/operations/__tests__/dispatch-lane.test.mjs:2799`, we:scripts/lib/__tests__/constellation-repos-profile.test.mjs:124,156,182).
   Changing it to `request` would break the canary. The canary is not a dispatched fix agent, so `run` stays valid there.
2. Both fix briefs' step 4 stops using `{{GATE_COMMAND}}` as the gate line and instead names the two guard-permitted
   commands directly, with **no quotes around the script path** (the guard regex needs whitespace right after
   `.mjs`; a quoted path is DENIED — probed): `node (rooted at {{WE_ROOT}}) we:scripts/verify-lane.mjs request --repo=.`, then
   `node (rooted at {{WE_ROOT}}) we:scripts/verify-lane.mjs check --wait=60000 --json --repo=.` (same unquoted shape as
   `we:skills-src/conveyor/delivery-agent-brief.md:248,395`). `{{WE_ROOT}}` is already a required token, so no
   required-token-list change. The `{{GATE_COMMAND}}` token-table rows in both briefs are updated to say it is
   informational (the sibling-repo-aware `run` form, unused as a command by a dispatched agent) or dropped if unused.
3. The `check` output is the verdict: `green` proceeds; `red` is the existing hard stop; `running` after the
   timeout → call `check --wait` again (bounded), never `sleep`-poll; other statuses per the delivery brief's table.
4. "Never run the full suite yourself" is reworded: the runner (`we:scripts/conveyor/verify-dispatch.mjs`) runs the same
   diff-selected gate. Stale comments saying `run` is the fix/ci-heal gate are corrected
   (`we:scripts/verify-lane.mjs:265-268`, `we:skills-src/batch-backlog-items/parallel-execute.workflow.js:511-520`).

**Edge case 3 (red must surface, not be swallowed).** `check --json` returns the marker's terminal `red` status with
exit code 2 (`we:scripts/verify-lane.mjs` header, exit codes) — a red gate is surfaced exactly as before, and the
brief's red-gate branch keys on that status/exit code, not on the request call (which always exits 0). The mid-work
`vitest related` wrapper (#4294) is advisory only and is NOT the terminal step; the fix brief keeps the split for its
terminal step because a fix agent's whole job is repairing a red PR, so a silent-pass check is unacceptable there.

**Residual risks, to record as results on the card.** (a) `we:scripts/conveyor/verify-dispatch.mjs:226-233` (`poolsToScan`) already
scans every pool under the lanes root, sibling repos included; confirm the runner's `we:scripts/verify-lane.mjs` resolves a sibling
lane's own gate. (b) `run` writes no marker; `request` does — confirm a stamped marker in a fix lane does not trip
`fix-procedure`/`pr-land` finish-guards. Never loosen `SANCTIONED_VERIFY_LANE_QUERY`.

## MVP

Musts only:
1. `we:skills-src/conveyor/fix-agent-brief.md` and `we:skills-src/conveyor/fix-agent-ci-brief.md` step 4 use request → `check --wait=60000 --json` with explicit
   red/running/green handling and the updated token-table row (`we:skills-src/conveyor/fix-agent-brief.md:48`, `we:skills-src/conveyor/fix-agent-ci-brief.md:37`).
2. Tests below, including the guard-permitted proof for `fix` and `ci-heal`, and the canary left green.
3. Record the residual-risk (a)/(b) results on the card.
4. Fix the two stale comments.

Explicitly OUT (→ Follow-ups): a mid-work `vitest related` step in the fix briefs; changing the guard's allowlist;
any other brief kinds (`prepare-*`, investigation) that may name a denied command.

## Test plan

- Canary/profile contract tests (`we:scripts/conveyor/__tests__/canary-stages.test.mjs`,
  `we:scripts/lib/__tests__/constellation-repos-profile.test.mjs`, `we:scripts/operations/__tests__/dispatch-lane.test.mjs`)
  stay GREEN unchanged — proves `gateFor` was not disturbed (regression pin, not RED).
- `we:scripts/__tests__/guard-bash.test.mjs` — regression pins (pass before and after; they document the contract the
  briefs must meet): the exact unquoted `request` and `check --wait=60000 --json --repo=.` commands are `null` for
  `fix` and `ci-heal` (also via `decide`); the quoted-path variant, the bare `run --repo=.`, and `run` wrapped in
  `we:scripts/readiness/heavy-admission.mjs run --` stay DENIED.
- `we:skills-src/conveyor/__tests__/` — a brief-lint test: fill each of `we:skills-src/conveyor/fix-agent-brief.md` / `we:skills-src/conveyor/fix-agent-ci-brief.md`
  with real tokens, extract every command in its bash fences, and assert none is denied by
  `dispatchedAgentVerificationReason(cmd, kind)` for that brief's kind (skipping lines that are not a gate/verify
  invocation). **RED before (the real RED case):** step 4's `{{GATE_COMMAND}}` line resolves to the denied `run`. This makes the class of
  defect (brief names a command its own guard denies) fail in CI, not just this instance.
- Edge case 3: a brief-content assertion that step 4 contains the `red` branch keyed to `check` output (not to the
  request call), so a future edit can't drop it.

## Proof plan

Before/after on the real surface, not only unit tests:
1. **Before:** pipe `{"tool_name":"Bash","tool_input":{"command":"<the filled step-4 gate line: node we:scripts/verify-lane.mjs run --repo=.>"}}` into
   `WE_DISPATCH_KIND=fix` via `we:scripts/guard-bash.mjs` (the real PreToolUse hook entry) → deny JSON. Capture.
2. **After:** same probe for the new `request` command and the `check --wait=60000 --json` command, for
   `WE_DISPATCH_KIND=fix` and `ci-heal` → no deny. Capture next to the before.
3. In a THROWAWAY lane (the live verify daemon will pick up the `running` marker): run `request --repo=.`, then `check --wait=60000 --json --repo=.`, and show the marker state
   (`running` → settled status) — and show a `we:scripts/conveyor/verify-dispatch.mjs` dry-run/listing picking that lane up. Repeat once against a sibling-repo lane to settle risk (a); if impossible, record exactly why.
4. Render both briefs via `fillBrief` with real tokens and show step 4 contains no `run --repo=.`.

## Follow-ups

- Add an optional mid-work `vitest related` via `we:scripts/readiness/heavy-admission.mjs run --` to the fix briefs (mirrors #4294).
- Sweep the remaining conveyor briefs (`prepare-*`, investigation, health) with the same brief-lint to catch any other
  command their kind's guard denies.
- If `we:scripts/conveyor/verify-dispatch.mjs` does not enumerate sibling-repo lanes and the build only works around it, file the
  enumeration fix as its own item.

## Progress

- Both fix briefs' step 4 now use `we:scripts/verify-lane.mjs` `request` → `check --wait=60000 --json --repo=.` (unquoted path); red keyed to `check` output (exit 2). `gateFor` untouched (canary/profile tests green). Stale comments in `we:scripts/verify-lane.mjs` and `we:skills-src/batch-backlog-items/parallel-execute.workflow.js` corrected. Guard pins + brief-lint test added.
- Residual risks (a) sibling-lane resolution by the verify runner and (b) marker-stamp vs `fix-procedure`/`pr-land` finish-guards: **NOT verified** in this session (no throwaway-lane live run). Still open.
