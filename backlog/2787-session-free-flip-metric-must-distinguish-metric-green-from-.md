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
holding the mode to shadow. `resolveLandMode`'s trail already states the true state correctly. Surfaced by
the `/review` clearance of #911 (item #2754, found already-built and resolved 2026-08-14).

## Scope and consumers

Two files, verified by reading both (not the card's original claim alone):

- `we:scripts/lib/decision-routing.mjs` — `computeAgreementMetric` (:374-386), whose `answer` string is the
  bug's source.
- `we:scripts/conveyor/decision-route.mjs` — the session-free metric-only branch (:170-178), the ONE consumer
  of `metric.answer` in a user-facing context. It never resolves `config`/`landMode` at all in this branch
  (that assignment is gated behind `Array.isArray(ledger)`, :160-166, which is false on this path) — so today
  it has no way to report the true armed state even if it wanted to.
- Checked for other consumers: `grep -rn "enforce armed|holds shadow"` across `scripts/` finds no other file
  parsing either string — display-only, no hidden control-flow coupling.
- One existing test asserts on `.answer` (`we:scripts/lib/__tests__/decision-routing.test.mjs:347`), but only
  via a regex on the numeric portion (`/20\/20 consecutive matches, 0 divergence/`), not the trailing
  parenthetical — unaffected by this fix.

## Size

**1**, unchanged from the original card. Two files, one string + one CLI branch, no new function, no schema
change, no consumer beyond the one CLI print site.

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
mode DOWN to shadow, never force `enforce` past a red metric (:400-405), so a below-trigger metric means
shadow unconditionally. Only `FLIP-READY (enforce armed)` asserts something the metric function can't know.

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
     const cliConfig = resolveDispositionConfig({ band: f.band === true ? undefined : f.band });
     const resolution = resolveLandMode({ records: agreement, configMode: cliConfig.landMode });
     if (f.json) {
       writeLineSync(1, JSON.stringify({ metric: resolution.metric, mode: resolution.mode, reason: resolution.reason }));
     } else {
       console.log([
         `flip-metric: ${resolution.metric.answer}`,
         `  trigger: N=${resolution.metric.N} consecutive matches, 0 divergences over the last M=${resolution.metric.M}`,
         `  effective mode: ${resolution.mode} (${resolution.reason})`,
       ].join('\n'));
     }
     process.exit(0);
   }
   ```
   `resolveDispositionConfig` and `resolveLandMode` are both already imported/used elsewhere in this file
   (:161, and `resolveLandMode` should be checked for an existing import — if absent, add it from
   `we:scripts/lib/decision-routing.mjs` alongside the existing `computeAgreementMetric` import). `--json`
   output GAINS two fields (`mode`, `reason`) rather than losing any — additive, not a breaking schema change.

## Tasks

1. Edit `computeAgreementMetric`'s `answer` template — drop both parentheticals.
2. Update the one existing test's fixture string if it asserts past the numeric prefix (verify first; per the
   scope check above it currently does not, so this task may be a no-op — confirm, don't assume).
3. Edit `we:scripts/conveyor/decision-route.mjs`'s session-free branch to resolve `landMode` and route through
   `resolveLandMode`, per the interface above.
4. Add a test for the session-free CLI path — there is currently **none** (checked: no `agreement-file` or
   `flip-metric` reference anywhere in `we:scripts/conveyor/__tests__/decision-route.test.mjs`). At minimum:
   metric green + `landMode: shadow` → output shows the metric AND shows effective mode is still shadow (the
   exact bug this card exists to fix); metric green + `landMode: enforce` → shows enforce; metric below
   trigger → shows shadow regardless of `landMode` (the always-true half).
5. Confirm via `--json` and human-readable output both.

## Done when

- [ ] `computeAgreementMetric`'s `answer` no longer claims `(enforce armed)` on a green metric.
- [ ] The session-free CLI path reports the metric AND the true effective mode/reason, sourced from
      `resolveLandMode`, not re-derived.
- [ ] A new test reproduces the exact misread this card describes (metric green, `landMode: shadow`) and
      confirms the output no longer claims enforce is armed.
- [ ] No control-flow change: `planDecision`'s actual disposition behavior (the `Array.isArray(ledger)` path)
      is untouched — this item only touches the metric-only, no-ledger branch and the answer string.

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
