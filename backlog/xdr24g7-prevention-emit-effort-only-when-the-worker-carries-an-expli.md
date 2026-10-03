---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/probation-launcher.mjs", "we:scripts/operations/dispatch-providers/build.mjs", "we:scripts/lib/dispatch-routing-policy.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/lib/__tests__/probation-launcher.test.mjs", "we:scripts/operations/dispatch-providers/__tests__/build.test.mjs", "we:scripts/lib/__tests__/dispatch-routing-policy.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-io.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "34811384f6240af356de75d8f2c4697e185dc3b3"
tags: []
---

# Prevention — Emit --effort only when the worker carries an explicit effort, and add a table test over every PROBATIO… (from chalbert/web-everything#3311 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/probation-launcher.mjs:57` — Emit `--effort` only when the worker carries an explicit effort, and add a table test over every PROBATION_WORKERS model through buildWorkerArgv and buildAgyDirectTaskArgv. Or add a check:standards rule that flags a default effort injected at a launcher boundary.
2. `we:scripts/operations/dispatch-providers/build.mjs:128` — A deterministic check in the dispatch-provider adapter that falls back to 'codex' or 'claude-restricted' (or relies on the delivery marker) when the policyRoute provider lacks a delivery implementation.
3. `we:scripts/lib/dispatch-routing-policy.mjs:28` — Test coverage for invalid policy edits with `inherit: true` and a string `effort`.
4. `we:scripts/operations/dispatch-lane-io.mjs:1780` — Check that indexOf('--effort') is not -1 before accessing the array element, or default to a known placeholder.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3311@4f38c1ff3b054458f911e1c085406d69d988abc3

## Done when

1. **Executable** — `npx vitest run` over the four test files named in the Test plan below (repo-relative, without the `we:` prefix) fails before this item lands (the new cases are RED) and pass after.

## Progress

- Premise check (2026-10-03, `main` @ 34811384): `git log -S` finds no commit delivering `xdr24g7`. All four guards are still absent. `we:scripts/lib/probation-launcher.mjs:57` still emits `--effort=${worker.effort ?? "medium"}`. `we:scripts/operations/dispatch-providers/build.mjs:127-128` still forwards any `policyRoute.provider`. `we:scripts/lib/dispatch-routing-policy.mjs:61` has no `inherit` + string-effort test. `we:scripts/operations/dispatch-lane-io.mjs:1790` still reads `argv[argv.indexOf('--effort') + 1]`. Citations are accurate except the last (was 1780, now 1790). Scope unchanged. Two test files named in `scope:` do not exist yet (`we:scripts/operations/dispatch-providers/__tests__/build.test.mjs`, `we:scripts/operations/__tests__/dispatch-lane-io.test.mjs`); the build creates them.

## Design

1. **Effort default (`we:scripts/lib/probation-launcher.mjs:57`).** `buildWorkerArgv` injects `medium` when `worker.effort` is unset. `PROBATION_WORKERS` (`we:scripts/lib/provider-routing.mjs:339`) carries no `effort`, so every launch without a routed effort gets a made-up `medium`. Change it to push `--effort=<x>` only when `worker.effort` is a non-empty string; otherwise omit the flag and let each launcher use its own default (`we:scripts/codex-direct-task.mjs:165` defaults to `CODEX_TIER_EFFORT.sonnet`; `buildAgyDirectTaskArgv` at `we:scripts/gemini-direct-task.mjs:132` already treats `undefined` as "no flag" and drops effort for `AGY_EFFORT_UNSUPPORTED_MODELS`). Add a table test looping every `PROBATION_WORKERS` entry through `buildWorkerArgv`, and the Gemini-launcher entries through `buildAgyDirectTaskArgv`, asserting no effort flag appears without an explicit effort and that an explicit effort passes through (and is dropped for the unsupported agy models).
2. **Provider without a delivery implementation (`we:scripts/operations/dispatch-providers/build.mjs:127-128`).** `deliveryAgent = request.policyRoute?.provider ?? marker` is pushed as `--provider=`. But `DELIVERY_AGENT_PROVIDERS` (`we:scripts/operations/deliver-item-wrapper.mjs:1296`) only has `claude-restricted` and `codex`, while the policy catalogue (`we:scripts/lib/dispatch-routing-policy.mjs:5`) also names `antigravity`, `agy-claude`, `agy-gemini`. Such a route makes the detached wrapper throw in `resolveDeliveryAgentProvider` after the lane is acquired. Add a pure `deliveryProviderFor(provider)` in `we:scripts/operations/dispatch-providers/build.mjs`: `claude` maps to `claude-restricted`; a name in `DELIVERY_AGENT_PROVIDER_NAMES` passes through; anything else falls back to the item's delivery marker, mapped and checked by the same rule (so a marker of `antigravity` cannot reintroduce the crash), else omits `--provider` (wrapper default `claude-restricted`). `wrapperExecutorFor` must receive the same resolved name so the run record stays truthful.
3. **Policy validation coverage (`we:scripts/lib/dispatch-routing-policy.mjs:61`).** `validateEffort(entry.effort)` is called with no provider for `inherit: true` entries, so a string effort resolves against `undefined` and throws "unknown effort … for undefined". Cover three cases in the policy test: `inherit: true` + string effort rejects; `inherit: true` + per-provider object effort accepts; `inherit: true` + unknown key rejects. Reword the error to name `inherit` only if it proves misleading.
4. **Missing `--effort` index (`we:scripts/operations/dispatch-lane-io.mjs:1790`).** `argv[argv.indexOf('--effort') + 1]` is `argv[0]` when the flag is absent, so the run record would report the executable as the effort. Add an exported `extractEffortFlag(argv)` beside `extractModelFlag` (`we:scripts/operations/dispatch-lane-io.mjs:2344`) handling `--effort=<v>` and `--effort <v>`, returning `undefined` when absent or valueless; call it at `:1790`.

## MVP

Musts only: items 1–4 above, each with its test. Out of scope: a `check:standards` rule flagging launcher-boundary default efforts; a real delivery implementation for `antigravity` / `agy-*`; giving `PROBATION_WORKERS` entries an effort.

## Test plan

- `we:scripts/lib/__tests__/probation-launcher.test.mjs` — table over every `PROBATION_WORKERS` entry, with and without an effort: no `--effort=` unless explicit. RED today because `?? "medium"` always emits it. The existing assertion (line 26) gains an explicit `effort: 'medium'` on its worker.
- `buildAgyDirectTaskArgv` effort handling (unsupported models drop it, supported pass it through) is already covered by `we:scripts/__tests__/gemini-direct-task.test.mjs` (~311-333); the build reuses that and adds no duplicate. Note `PROBATION_WORKERS['antigravity-claude'].model` is `null` (`we:scripts/lib/provider-routing.mjs:341`) and `buildWorkerArgv` throws on a null model, so the table test supplies a concrete model for that entry (as the real dispatch does via the routed model) and separately asserts the null-model throw.
- `we:scripts/operations/dispatch-providers/__tests__/build.test.mjs` (new) — `policyRoute.provider` of `agy-gemini` / `antigravity` does not yield `--provider=agy-gemini`; it falls back to the marker or omits the flag. RED today because the name is forwarded verbatim. `claude` still maps to `claude-restricted`; `codex` passes through.
- `we:scripts/lib/__tests__/dispatch-routing-policy.test.mjs` — the three `inherit: true` cases in Design 3. The string-effort and unknown-key cases are preservation (GREEN today; mutation proof: make `validateEffort` skip `inherit` entries and the string-effort case goes RED); the object-effort case is a capability check that guards the accepted shape.
- `we:scripts/operations/__tests__/dispatch-lane-io.test.mjs` (new) — `extractEffortFlag` on `[]`, `['--effort']`, `['--effort=high']`, `['--effort','low']`, and an argv with no flag whose first element is a path. RED today: the inline expression returns the path.

## Proof plan

Run the four test files before (new cases RED, failing assertion shown) and after (green) in the lane. Then a CLI probe: `node -e` calls `buildWorkerArgv` for each `PROBATION_WORKERS` entry with no effort and prints argv. The probe supplies a concrete model for `antigravity-claude` (its registry model is `null`, which `buildWorkerArgv` rejects). Before: `--effort=medium` on all three. After: none. Also call `extractEffortFlag(['claude','--bg'])`: `undefined`, where the old expression gave `'claude'`. Put both outputs in the PR body.

## Follow-ups

- `check:standards` rule flagging a default effort injected at a launcher boundary (the card's alternative to the table test).
- A real `antigravity` / `agy-*` delivery provider in `DELIVERY_AGENT_PROVIDERS`, so the policy route need not fall back.
- Give `PROBATION_WORKERS` entries an explicit effort, or document that the launcher default is intended.
