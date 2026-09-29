---
bornAs: xhmxvtc
kind: story
size: 3
tier: pinned
status: resolved
scope: ["we:scripts/conveyor/build-dispatch-policy.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/queue-report.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "30c4c6925a23402b2acbb37e406184a520aa3aa5"
tags: []
---

# Builder builds only prepared cards; unprepared ones get a prepare pass first

Operator rule (Mon 2026-09-28 6:00 PM ET): PREPARE = full design + explicit MVP cut; build only the MVP. The build daemon's queue (we:scripts/readiness/dispatch-plan.mjs, we:scripts/conveyor/build-dispatch-policy.mjs) dispatches unprepared cards anyway (dispatch-plan tags nearly every row 'unprep'). Live 2026-09-29 cost: #4295 built then declined (declared scope wrong), #4380 built but already done on main, #4108 built but superseded — each a full build agent run a prepare pass would have avoided. MVP: the builder dispatches a card only if it carries a truthful preparedDate; an unprepared queued card is dispatched as a PREPARE job instead (premise check vs main, scope corrected to the real touch-set, Design/MVP/Test plan/Proof plan written, prepare-stamp; already-done → resolve with graduatedTo; wrong premise → stop and report), and becomes build-eligible once stamped. Must: tests for the gate and the prepare route; soak break (unprepared card dispatched as a build) RED before / GREEN after; live proof: the next unprepared queued item gets a prepare job, not a build. Measure with #4304's prepared-vs-not run rating.

## Design

**Premise check (vs main, 2026-09-29):** Not already done, not superseded. Confirmed by reading the live code: `dispatchPlan()`
(`we:scripts/readiness/dispatch-plan.mjs`) holds `kind:decision`/`kind:investigation`/grouping items unconditionally,
but a scoped `story`/`task` candidate falls straight through to the lane/capacity gates with **no `preparedDate`
read at all** — it launches to build with no prepare check. `planBuildDispatch()`
(`we:scripts/conveyor/build-dispatch-policy.mjs`) never even sees `preparedDate`; it only evaluates candidates
`dispatchPlan()` already decided to launch. So the premise (unprepared cards get built) holds.

**Scope correction:** Declared scope named 2 files. The gate itself belongs entirely in `we:dispatch-plan.mjs`'s pure core `dispatchPlan()`
plus its own CLI IO shell in the same file (which is what feeds `we:tick-core.mjs` → the real build-dispatch daemon
— confirmed by tracing `we:scripts/conveyor/tick-core.mjs`'s `main()`, which shells `node we:dispatch-plan.mjs --json`
for the live `plan.launch`/`plan.held`). One more file is required, not "far outside":
`we:scripts/readiness/queue-report.mjs` hard-refuses (throws) on any `HELD_REASONS` token it doesn't already
classify into one of its 3 buckets — adding a new held reason without teaching this file about it breaks that
file's own existing test at run time. Added it to `scope:` above. `we:scripts/conveyor/build-dispatch-policy.mjs`'s
change is documentation-only (a new row in its declared `BUILD_DISPATCH_POLICY.rules` table, which exists
specifically so every operator rule is visible even when a different file enforces it) — no logic in that file
changes, since an unprepared candidate never reaches its `planBuildDispatch()` at all once `we:dispatch-plan.mjs`
holds it upstream. `we:scripts/conveyor/tick-core.mjs` needs NO change: a new held reason with no dedicated spawn
note falls through to its existing generic hold-note path unchanged.

**The gate itself:** Add a 4th readiness-gate axis to `dispatchPlan()`, sitting alongside (same opt-in pattern as) `sizePolicy`:
- New pure-core param `preparePolicy` (default `null` = gate OFF, so every existing caller/test that doesn't pass
  it keeps today's behavior — the same "off unless the IO shell opts in" contract `sizePolicy`/`dispatchPaused`
  already use, and the reason no existing test needed rewriting).
- When `preparePolicy` is supplied, a scoped candidate (already past the `unshaped-no-scope` gate) with no
  truthful `preparedDate` (a valid `YYYY-MM-DD` string) is held `needs-prepare` — checked right after the
  `no-size` gate (itself right after the scope gate), same precedence class (a readiness gate, not a
  lane-scheduling concern). `fix`/`ci-heal` are exempt (same `sizeExempt` boolean already used for the size
  gate — neither kind can reach this queue via the production shell). **Honest limit:** "truthful" here is a
  FORMAT check on self-attested frontmatter (a well-formed `YYYY-MM-DD` string), never a verified/signed claim —
  it catches a missing or malformed stamp, not a stale or hand-typed one on an otherwise-unprepared card.
  Provenance-checking (e.g. cross-checking `preparedAgainstSha`) is a possible future hardening, out of this
  MVP's scope.
- The CLI `main()` IO shell (same file) enriches each queue row with `preparedDate` off the loaded backlog item
  (mirrors how `size`/`estimatedLoc` are already enriched) and turns the gate ON by default
  (`preparePolicy = { requirePreparedDate: true }`), skippable via `--no-prepare-check` (mirrors the file's own
  `--no-size-check`/`--no-drift-check`/`--no-pause-check` escape hatches) — so the LIVE daemon enforces this
  unconditionally, while direct/test callers of the pure core are unaffected unless they opt in.
- `we:scripts/readiness/queue-report.mjs`: add `needs-prepare` to `NOT_READY_REASONS` (same bucket as
  `unshaped-no-scope`/`needs-slice`/`needs-decision`/`needs-investigation` — "needs an action before it can ever
  be picked up").
- `we:scripts/conveyor/build-dispatch-policy.mjs`: add a `needs-prepare` row to `BUILD_DISPATCH_POLICY.rules`
  naming `we:dispatch-plan.mjs` as the enforcer (documentation parity with the file's other declared-but-elsewhere-
  enforced rows, e.g. `scratch-prefix`).

## MVP

**Builds (Musts):** the READINESS GATE ONLY — a card lacking a truthful `preparedDate` is never dispatched as a
build; it is held `needs-prepare` and surfaces in the queue report / dry-run exactly like every other
`not-ready` hold. This alone closes the cost driver named above (#4295/#4380/#4108-shaped waste: a full build
agent run on a card whose premise/scope had never been checked).

**Does NOT build (a red-team-caught overclaim risk, called out explicitly here so the title/body's "gets a
PREPARE job instead" language is never mistaken for what actually shipped):** this MVP never spawns anything for
a `needs-prepare` hold. It only holds — the same as every unprepared card holds today until a human runs
`we:backlog.mjs prepare-stamp` by hand, or the filed follow-up (below) lands and starts spawning the agent that
does. Read the title/body above as the FULL vision this card is a first step toward, not this diff's own
Done-when.

## Test plan

- `we:scripts/readiness/__tests__/dispatch-plan.test.mjs`: `preparePolicy` OFF (default) leaves an unprepared item
  launching exactly as before (backward compat); ON, an unprepared scoped story holds `needs-prepare`; a prepared
  one (valid `preparedDate`) launches; `fix`/`ci-heal` are exempt even unprepared; an unscoped item still holds
  `unshaped-no-scope` (precedence unchanged); `HELD_REASONS` contains `needs-prepare`.
- `we:scripts/readiness/__tests__/queue-report.test.mjs`: already iterates every `HELD_REASONS` token through
  `classifyHeld` — passes once `needs-prepare` is classified, refuses (as it does today) if it isn't.
- `we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs`: update the `rules.map(id)` pin to include
  `needs-prepare`.

## Proof plan

- **Soak break** (`we:scripts/conveyor/soak/breaks/unprepared-card-dispatched-as-build.mjs`): calls
  `dispatchPlan()` directly (the real function the live daemon's IO shell calls) with one prepared + one
  unprepared scoped candidate under the live default `preparePolicy`. RED (pre-fix tree): the unprepared
  candidate launches. GREEN (post-fix, this tree): it holds `needs-prepare`, and the prepared sibling still
  launches — registered in `we:scripts/conveyor/soak/breaks/index.mjs` via directory discovery (no hand-edit).
- **Live proof**: `node we:skills-src/conveyor/build-dispatch-daemon.mjs --dry-run` from the lane (read-only; never
  restarts/edits the running daemon) against the real queue, showing the next unprepared queued item's `daemon`
  column read `hold [...] needs-prepare` instead of `WOULD DISPATCH NOW`.

## Follow-ups

Filed we:backlog/4505-harden-needs-prepare-prepareddate-validation-calendar-aware.md — a converge round-2
panel (correctness/security/standards-conformance) found the `YYYY-MM-DD` format check accepts a
calendar-impossible date (`2026-13-45`) and could mis-hold a genuinely prepared card if a loader ever parsed an
unquoted date into a `Date` object; also, the equivalent check is duplicated in spirit (never structurally)
across we:backlog.mjs's `prepare-stamp`, we:scripts/readiness/engine.mjs's `prepared` derivation, and this gate.
Fix: one shared `isPreparedDate()` helper, calendar-aware and `Date`-safe.

Filed we:backlog/4504-spawn-a-full-prepare-agent-for-needs-prepare-holds-design-mv.md (`blockedBy: 4470`) —
actually SPAWNING a dedicated "prepare" agent for a `needs-prepare` hold (the card's fuller "dispatched as a
PREPARE job instead" language). The existing `prepare` job kind (`spawnPrepareScope` /
we:skills-src/conveyor/prepare-scope-agent-brief.md) only authors a missing `scope:` — a narrow, mechanical,
single-file edit. The operator's rule here ("PREPARE = full design + explicit MVP cut") is a materially bigger
job (premise check, scope correction, Design/MVP/Test-plan/Proof-plan authoring, prepare-stamp) with no existing
agent brief, no we:scripts/conveyor/tick-core.mjs spawn-list wiring, and no we:scripts/operations/dispatch-lane-io.mjs
launch-kind route — genuinely far outside this story's declared touch-set and its `size: 3`. Left out of THIS
item's MVP and filed separately rather than half-built here.

## Done when

1. **Executable** — run this from the WE checkout root (fenced-block paths below are real filesystem paths, not
   the `we:` citation prefix used in prose elsewhere in this card):
   ```
   npx vitest run scripts/readiness/__tests__/dispatch-plan.test.mjs \
     scripts/readiness/__tests__/queue-report.test.mjs \
     scripts/conveyor/__tests__/build-dispatch-policy.test.mjs \
     scripts/conveyor/__tests__/dispatcher-fixture-harness.test.mjs \
     scripts/conveyor/soak/breaks/unprepared-card-dispatched-as-build.soak.test.mjs
   ```
   fails before this item lands (no `needs-prepare` gate exists, and `we:dispatcher-fixture-harness.test.mjs` has
   no case for an unprepared item) and passes after.
2. A scoped story/task candidate with no truthful (well-formed `YYYY-MM-DD`, self-attested — not
   provenance-verified) `preparedDate` is held `needs-prepare` under the live daemon's default policy, and the
   same candidate with a valid `preparedDate` still launches — BOTH proven through the REAL CLI
   (`we:dispatch-plan.mjs`'s own `main()`, not only the pure core called directly), via
   `we:dispatcher-fixture-harness.test.mjs`'s new case plus its existing first case (a prepared item through the
   full chain). `fix`/`ci-heal` exemption is proven at the pure-core level
   (`we:scripts/readiness/__tests__/dispatch-plan.test.mjs`) — not separately re-proven through the CLI, since
   neither kind can reach this queue via the production build-queue shell in the first place.
3. `node we:skills-src/conveyor/build-dispatch-daemon.mjs --dry-run` (run from the WE checkout root) shows the
   effect live, read-only, with no daemon restart/edit.
