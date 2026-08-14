---
bornAs: xjo9hle
kind: story
size: 1
parent: "2753"
status: open
dateOpened: "2026-07-28"
scope: ["we:scripts/lib/decision-routing.mjs", "we:scripts/conveyor/decision-route.mjs"]
tags: [conveyor, decision, ratification, observability]
---

# Session-free flip metric must distinguish metric-green from operator-armed enforce

`computeAgreementMetric`'s `answer` string hardcodes `"FLIP-READY (enforce armed)"` on a green metric, but the
function has no knowledge of whether the operator armed enforce (`landMode`). The CLI's session-free
`--agreement-file` path (`we:scripts/conveyor/decision-route.mjs`) prints that string bare, so an operator
reading it can misread "metric is green" as "auto-ratify is live" when the operator ceiling is in fact still
holding the mode to shadow. `resolveLandMode`'s trail carries the correct explanatory sentence — but its
`trail[0]` is `metric.answer` verbatim, so the ledger path prints the false claim and its own correction on
two adjacent lines (see Scope and consumers). Surfaced by the `/review` clearance of #911 (item #2754, found
already-built and resolved 2026-08-14).

## Scope and consumers

Two files, verified by reading both (not the card's original claim alone):

- `we:scripts/lib/decision-routing.mjs` — `computeAgreementMetric` (:374-386), whose `answer` string is the
  bug's source.
- `we:scripts/conveyor/decision-route.mjs` — the session-free metric-only branch (:170-178), the branch this
  card was filed against. It never resolves `config`/`landMode` at all in this branch (that assignment is
  gated behind `Array.isArray(ledger)`, :160-166, which is false on this path) — so today it has no way to
  report the true armed state even if it wanted to.
- **A SECOND user-facing consumer of `metric.answer` exists** (an earlier revision of this card wrongly called
  the session-free branch the only one). `resolveLandMode` embeds `metric.answer` verbatim as `trail[0]`
  (`we:scripts/lib/decision-routing.mjs:422`, `:431`, `:432`), and the WITH-ledger CLI path prints
  `plan.landMode.trail` (`we:scripts/conveyor/decision-route.mjs:198-199`). So the contradiction is already
  visible on `main` today in the ledger path, two adjacent lines:
  ```
  land-mode: shadow (metric-green-but-operator-shadow)
    20/20 consecutive matches, 0 divergence(s) in the last 20/20 decided → FLIP-READY (enforce armed)
    metric is FLIP-READY, but the operator landMode is shadow (un-armed) — held observe-only …
  ```
  Reproduce by running `we:scripts/conveyor/decision-route.mjs` with `--stdin` and piping it a converged jury
  `ledger` plus a 20-match `agreement` array. Stripping the parenthetical (interface 1) fixes BOTH sites at
  once — no extra work, but the builder must expect the ledger path's printed text to change too, and must
  not read "no control-flow change" as "that path's output is byte-identical".
- Checked for other consumers TWO ways. (a) ES imports / string parsing: `grep -rn "enforce armed|holds
  shadow|\.answer"` across `we:scripts/` finds no file parsing either string — display-only, no hidden
  control-flow coupling. (b) Subprocess / CLI callers of `we:scripts/conveyor/decision-route.mjs`: `grep -rn
  "decision-route"` over the whole repo (excluding `node_modules`) finds NO invoker outside its own test —
  not in `.claude` skills, not in `we:docs/`, not in another script. So the CLI's stdout format has exactly
  one machine consumer (`we:scripts/conveyor/__tests__/decision-route.test.mjs`) and otherwise only human
  readers.
- One existing test asserts on `.answer` (`we:scripts/lib/__tests__/decision-routing.test.mjs:347`), but only
  via a regex on the numeric portion (`/20\/20 consecutive matches, 0 divergence/`), not the trailing
  parenthetical — unaffected by this fix. No test asserts on `resolveLandMode`'s `trail` contents either
  (`:351-380` assert `mode`/`reason`/`metric.flipReady` only), so the trail's text change breaks nothing.

## Size

**1**, unchanged from the original card. Basis: two files, one string edit + one CLI branch rewrite, no new
exported function, no schema change, no migration. The second `metric.answer` consumer found above does not
add work — it is fixed by the same one-line string edit — but it does add one extra assertion to write.

## The decided design (the card's own "or" resolved)

The card posed an open choice: make the metric landMode-aware, **or** strip the claim from the metric and let
the mode resolver own armed/not-armed wording. **Taking the second.** Reasoning: `computeAgreementMetric` is
documented as pure metric computation with no `config`/`landMode` input in its signature
(`computeAgreementMetric(records, {N, M})`) — threading operator-config state into it would blur a
single-purpose function into two concerns. `resolveLandMode` already computes the correct armed/not-armed
trail (`we:scripts/lib/decision-routing.mjs:411-431`, e.g. `'metric is FLIP-READY, but the operator landMode
is shadow (un-armed) — held observe-only...'`) — the fix is to make the CLI's session-free branch use it,
not to teach the metric function a new input.

Also decided: only the `flipReady` half of the string is actually wrong. The `below trigger (holds shadow)`
half is **always true regardless of operator config** — `resolveLandMode`'s ceiling can only ever hold the
mode DOWN to shadow, never force `enforce` past a red metric. Proven by the CODE, not just the doc comment at
`:400-405`: the ceiling is computed at `:413`, an un-armed ceiling returns `shadow` outright (`:416-428`), and
the armed branch still returns `shadow` whenever `metric.flipReady` is false (`:430-432`). So a below-trigger
metric means shadow unconditionally, and only `FLIP-READY (enforce armed)` asserts something the metric
function can't know.

## Interfaces and protocol

1. `we:scripts/lib/decision-routing.mjs`, `computeAgreementMetric`'s `answer` template (:384) — drop the
   parentheticals entirely rather than rewording them, since the metric has no basis for either claim:
   ```js
   const answer = `${consecutiveMatches}/${N} consecutive matches, ${divergencesInWindow} divergence(s) in the last ${window.length}/${M} decided → ${flipReady ? 'FLIP-READY' : 'below trigger'}`;
   ```
   Return shape (`{ consecutiveMatches, divergencesInWindow, windowSize, decided, N, M, flipReady, answer }`)
   is otherwise unchanged — no caller reads a field that moves.

2. `we:scripts/conveyor/decision-route.mjs`, the session-free branch (:170-178) — resolve `config`/`landMode`
   in THIS branch too (today gated behind `Array.isArray(ledger)`, which this branch never satisfies), and
   print the armed state alongside the metric using `resolveLandMode`'s own trail rather than re-deriving the
   wording locally:
   ```js
   if (Array.isArray(agreement) && !Array.isArray(ledger)) {
     // landMode is GLOBAL-only (review-policy.mjs :381-383) — no band/decision layer touches it, so resolve it
     // with NO band. Keep the try/catch anyway if you ever pass a band: resolveDispositionConfig THROWS on an
     // unknown band, and this file's contract is "a bad band fails loud at the impure boundary" (:155-157).
     const resolution = resolveLandMode({ records: agreement, configMode: resolveDispositionConfig().landMode });
     if (f.json) {
       writeLineSync(1, JSON.stringify({ metric: resolution.metric, landMode: { mode: resolution.mode, reason: resolution.reason, trail: resolution.trail } }));
     } else {
       console.log([
         `flip-metric: ${resolution.metric.answer}`,
         `  trigger: N=${resolution.metric.N} consecutive matches, 0 divergences over the last M=${resolution.metric.M}`,
         `land-mode: ${resolution.mode} (${resolution.reason})`,
         ...resolution.trail.slice(1).map((t) => `  ${t}`),
       ].join('\n'));
     }
     process.exit(0);
   }
   ```
   Three things this shape gets right that a hand-rolled version would not:

   - **Import.** `resolveDispositionConfig` is already imported (`:57`) and used (`:161`). `resolveLandMode` is
     **NOT imported** in this file today (the import list is `planDecision, computeAgreementMetric,
     recordShadowOutcome, DECISION_PROCESSES, RULING_ACTIONS`, `:50-56`) — add it.
   - **No unguarded throw.** Calling `resolveDispositionConfig({ band })` outside the existing `try/catch`
     would turn a bad `--band` into an unhandled exception + stack trace + exit 1, replacing the file's
     `console.error` + exit 2 contract. Since `landMode` is global-only, the band buys nothing here — pass no
     band and the throw is impossible. (If a future change does need the band on this path, hoist the
     existing `try/catch` block above the branch rather than duplicating it.)
   - **One vocabulary, not two.** Reuse the ledger path's existing `land-mode: <mode> (<reason>)` label and
     print `resolution.trail`'s explanatory sentence (`.slice(1)` drops `trail[0]`, which is `metric.answer`
     and is already on the `flip-metric:` line). A new `effective mode:` label plus a dropped trail sentence
     would give the same concept two spellings across the two CLI paths — and the dropped sentence is exactly
     the one ("held observe-only — arm with `landMode: enforce`") that cures the misread this card exists to
     fix.

   `--json` output GAINS one nested `landMode` object rather than losing anything — additive, and it mirrors
   the ledger path's `plan.landMode` shape so a reader parses ONE flip-state shape, not two.

## Tasks

1. Edit `computeAgreementMetric`'s `answer` template — drop both parentheticals.
2. Update the one existing test's fixture string if it asserts past the numeric prefix (verify first; per the
   scope check above it currently does not, so this task may be a no-op — confirm, don't assume).
3. Add `resolveLandMode` to the existing `we:scripts/lib/decision-routing.mjs` import block (`:50-56`) — it is
   not imported today.
4. Edit `we:scripts/conveyor/decision-route.mjs`'s session-free branch to resolve `landMode` and route through
   `resolveLandMode`, per the interface above. Pass NO band to `resolveDispositionConfig` (global-only knob,
   and it keeps the unknown-band throw out of an unguarded call site).
5. Add a test for the session-free CLI path — there is currently **none** (checked: no `agreement-file` or
   `flip-metric` reference anywhere in `we:scripts/conveyor/__tests__/decision-route.test.mjs`). Two mechanics
   the builder needs and the existing suite does not yet give:
   - The `run()` helper (`:15-22`) `JSON.parse`s stdout, so it only serves `--json`. Add a raw sibling that
     returns the string, for the human-readable assertions.
   - No temp file is needed: piping `{"agreement":[…]}` (with no `ledger`) through `--stdin` reaches the same
     session-free branch. Verified against `main`.

   **The `landMode: enforce` case is NOT reachable from the CLI** — `landMode` is global-only, read from the
   ratified policy contract, currently `shadow`, and explicitly non-overridable by band or flag
   (`we:scripts/lib/review-policy.mjs:355-361`). An earlier revision of this card asked for a CLI test that
   "shows enforce"; that test cannot be written without mutating the ratified contract. Split it instead:
   - CLI, 20 matches → stdout shows the metric AND `land-mode: shadow (metric-green-but-operator-shadow)` AND
     the "un-armed / held observe-only" sentence; assert the output does **not** match `/enforce armed/`.
     This is the exact misread, reproduced and then killed.
   - CLI, a below-trigger ledger → `land-mode: shadow (operator-shadow-ceiling)`, and again no `armed` claim.
   - Unit (`we:scripts/lib/__tests__/decision-routing.test.mjs`) for the armed half, where `configMode` IS
     injectable: `resolveLandMode({ records: matches(20), configMode: LAND_MODES.ENFORCE })`. Already covered
     at `:364-368`; extend it to assert `trail[0]` no longer carries `(enforce armed)`.
6. Confirm via `--json` and human-readable output both, on BOTH CLI paths — the ledger path's printed trail
   changes too (see Scope and consumers).

## Done when

- [ ] `grep -rn "enforce armed\|holds shadow" we:scripts/` returns zero hits. (Both parentheticals gone, both
      `answer` branches, one check.)
- [ ] A named test fails if the fix is reverted. Revert the `answer` template edit alone and the new
      session-free CLI test must go RED on the `/enforce armed/` assertion — run it and confirm, don't infer.
- [ ] The session-free CLI, given 20 matches, prints the metric AND `land-mode: shadow
      (metric-green-but-operator-shadow)` AND the "held observe-only — arm with `landMode: enforce`" sentence.
      Asserted on real stdout, not on a return value.
- [ ] `we:scripts/conveyor/decision-route.mjs` contains no armed/un-armed wording and no `flipReady` ternary of
      its own — grep the file for `armed` and `flipReady`; the only hits should be inside a comment. (This is
      the checkable form of "sourced from `resolveLandMode`, not re-derived".)
- [ ] `--json` on the session-free path emits `{ metric, landMode: { mode, reason, trail } }`, and `metric`'s
      own keys are byte-for-byte the same set as before (`consecutiveMatches`, `divergencesInWindow`,
      `windowSize`, `decided`, `N`, `M`, `flipReady`, `answer`) — additive only.
- [ ] `planDecision`'s DISPOSITION BEHAVIOR is unchanged: the existing suites in
      `we:scripts/lib/__tests__/decision-routing.test.mjs` and
      `we:scripts/conveyor/__tests__/decision-route.test.mjs` pass untouched. Its printed OUTPUT does change —
      the ledger path's `land-mode` trail loses `(enforce armed)` too — and that is intended, not a regression.
      Confirm by eye on the reproduction in Scope and consumers.

## Delivery shape

Lands in one piece behind `main` — two small, additive edits (a string, a branch), no schema break, no
migration. No slicing needed at size 1.

## Watch for

- Don't let "fix the string" quietly expand into re-deriving the armed/not-armed decision logic a second time
  in the CLI — the whole point is `resolveLandMode` already owns that logic correctly; route through it, don't
  duplicate it.
- The below-trigger branch's wording (`below trigger`) doesn't need the `(holds shadow)` parenthetical either,
  once removed — keep both branches symmetric rather than fixing only the one that was provably wrong and
  leaving the other oddly asymmetric.
- Don't add `{ band: f.band }` to the session-free `resolveDispositionConfig()` call "for symmetry with the
  ledger path". `landMode` is global-only, so the band changes nothing, and an unguarded call converts a bad
  `--band` from a clean exit-2 into a stack trace.
- Don't try to write a CLI test that shows `land-mode: enforce`. It is unreachable without editing the
  ratified policy contract; the armed half belongs in the pure-core unit test (task 5).
