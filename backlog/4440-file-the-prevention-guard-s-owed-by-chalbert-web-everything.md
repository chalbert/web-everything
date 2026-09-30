---
bornAs: xrai0gj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs", "we:scripts/lib/antigravity-judge-spawn.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "b7d0da2e99219114370eb8b8282f70632d3c4d8f"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2891's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs:141` — A unit test asserting that `Object.values(ANTIGRAVITY_MODEL_EFFORT_OVERRIDES[model]).every(v => Object.values(ANTIGRAVITY_EFFORT_MAP).includes(v))`.
2. `we:scripts/lib/antigravity-judge-spawn.mjs:225` — A lint rule or convention discouraging defensive normalizations within map lookups, preferring direct `Map[key]` to fail fast and ensure the key matches downstream usage.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2891@a27b4abeec766856aa69507e14fabf65eb918fea

## Done when

1. **Executable** — `npm run test:unit -- we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs` passes with the
   two new guard tests, and each goes RED under its named mutation (see Test plan) — the tests are pure guards
   on already-correct code, so "fails before" is proven by mutating `we:scripts/lib/antigravity-judge-spawn.mjs`
   in the lane, not by a pre-fix commit.

## Progress

- Premise check (2026-09-30, `main` @ b7d0da2e9): not delivered. `git log` shows #4440 / `xrai0gj` only in the
  JIT-numbering drain commit; `we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs` has no assertion tying
  `ANTIGRAVITY_MODEL_EFFORT_OVERRIDES` values to `ANTIGRAVITY_EFFORT_MAP` values (the clamp tests at :116-159 only
  check the single `medium -> high` entry), and none covers a whitespace-padded model.
- Citation drift corrected: the card's `:141` and `:225` anchors came from the #2891 review diff. On `main`
  the override table is `we:scripts/lib/antigravity-judge-spawn.mjs:209`, the resolver (`key = model.trim()`,
  the "defensive normalization" the review flagged) is `:221-225`, the CLI-level map is `:182`, and the argv
  emit site (`model.trim()` at `--model`, then `resolveAntigravityModelEffort(model, mapped)`) is `:305-321`.
  Scope is unchanged (both files are the right ones).

## Design

Two guards, both in `we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs`, next to the existing
`resolveAntigravityModelEffort` describe block (~:140). No production code changes.

1. **Override values stay legal CLI efforts.** `ANTIGRAVITY_MODEL_EFFORT_OVERRIDES` (`:209`) maps an unsupported
   effort to the nearest supported one, and that result is passed straight to `--effort` *after* the
   `ANTIGRAVITY_EFFORT_MAP` (`:182`) validation, so nothing re-checks it. Add a test asserting every override
   value is in `Object.values(ANTIGRAVITY_EFFORT_MAP)` (and, stronger, that every override *key* is too, since a
   key outside the map could never be reached). Fails the day someone adds e.g. `{ medium: 'extreme' }`.
2. **Lookup key == emitted `--model` value.** The review's concern with `resolveAntigravityModelEffort`
   (`:221-225`) is that it normalizes (`trim()`) the key used for the table lookup; if that ever diverged from
   what `buildAntigravityJudgeArgv` emits for `--model` (`:311`, `model.trim()`; the resolver receives the RAW model at `:320` and trims independently), the clamp would silently
   apply to a different model string than the one `agy` runs. The literal ask (a lint/convention discouraging the normalization) is DEFERRED, not satisfied here — see Follow-ups; instead of a lint rule (unenforceable for one
   lookup, and this repo's gate has no per-function lint hook), pin the behavior: for a whitespace-padded
   `'  gemini-3.1-pro  '` (two-space padding) + `medium`, assert argv contains `--model gemini-3.1-pro` (trimmed) AND `--effort high`
   (override applied) — i.e. the string that selected the override is byte-identical to the one emitted.

## MVP

Musts: the two tests above. OUT (see Follow-ups): a lint rule, removing the `trim()` normalization, touching
any other provider's effort map.

## Test plan

- `every ANTIGRAVITY_MODEL_EFFORT_OVERRIDES value (and key) is a known ANTIGRAVITY_EFFORT_MAP value` — asserts
  membership. RED under mutation: change the override to `{ medium: 'extreme' }` in the lane and the test
  fails (today's unmutated table passes, as it must).
- `a whitespace-padded model resolves the same override and emits the same trimmed --model` — builds argv with
  `model: '  gemini-3.1-pro  ', effort: 'medium'`; asserts `--model gemini-3.1-pro` and `--effort high`.
  RED under mutation: drop `.trim()` from `resolveAntigravityModelEffort` and the clamp is missed
  (`--effort medium`), so the assertion fails.

## Proof plan

Run the file under `test:unit` green on the unmutated lane; then apply each named mutation to
`we:scripts/lib/antigravity-judge-spawn.mjs` locally, capture the RED run output for the PR body, revert the
mutation (`git checkout --` the file) and re-run green. Nothing else needs a live surface — the change is
test-only.

## Follow-ups

- A repo convention/lint discouraging defensive normalization inside map lookups generally (guard 2's literal
  ask) — broader, needs a policy call on where such a rule would live; file as its own item if wanted.
- The same override-vs-map subset guard for `we:scripts/lib/codex-judge-spawn.mjs`'s `CODEX_EFFORT_MAP` if it grows per-model
  overrides.
