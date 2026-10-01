---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-bash.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add negative-case tests (vitest --version, vitest --config x run f) to the 'admitted vitest must be one… (from chalbert/web-everything#3258 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/guard-bash.mjs:538` — Add negative-case tests (`vitest --version`, `vitest --config x run f`) to the 'admitted vitest must be one-shot' describe block. The sibling test in #3793 already pins `npx vitest --version` as unflagged for the raw form.
2. `we:scripts/guard-bash.mjs` — A unit test explicitly asserting that non-vitest commands containing 'vitest' as an argument (e.g. `npx foo vitest`) are not flagged by the vitest guard.
3. `we:scripts/guard-bash.mjs` — A unit test asserting that `yarn vitest` without `--run` is also caught by the watch mode guard.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3258@8e15f9fa8d7dbc18ae1f900501bf25685f622bec

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
