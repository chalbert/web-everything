---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs", "we:scripts/conveyor/soak/breaks/lease-reaper-graphql-unattributed.mjs", "we:scripts/__tests__/lane-pool.test.mjs", "we:scripts/conveyor/soak/breaks/__tests__/lease-reaper-graphql-unattributed.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2902's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lane-pool.mjs:1556` — Extend the soak break, or add a lane-pool integration assertion, to check argv shape (`api -i` vs `pr list`) at the acquire-time call site too. Longer term, a check:standards lint flagging bare `execFileSync('gh', ['pr','list'…])` in scripts/.
2. `we:scripts/conveyor/lease-reaper.mjs:683` — A unit test asserting that a REST payload for a merged PR (state: 'closed', merged_at: date) maps exactly to { state: 'MERGED' }.
3. `we:scripts/conveyor/__tests__/lease-reaper.test.mjs:1017` — A review convention or check:standards lint requiring mock payloads to accurately reflect the schema of the specific endpoint being mocked.
4. `we:scripts/conveyor/lease-reaper.mjs:681` — A unit test that validates the end-to-end PR state reduction (`prStatesFromList`) using a genuine, unmodified REST payload for a merged PR, rather than testing the mapper in isolation and incorrectly asserting `state: 'closed'` as the expected output.
5. `we:scripts/conveyor/soak/breaks/lease-reaper-graphql-unattributed.mjs:66` — A convention or lint rule requiring mock HTTP/subprocess responses to use genuine output payloads collected from the real system via `curl` or `gh api`, rather than hand-authoring them.
6. `we:scripts/conveyor/lease-reaper.mjs` — A unit test in `restPullToPrStateShape` that asserts a REST merged PR (with `state: "closed"` and `merged_at`) maps to `state: "MERGED"`, validating the behavioral contract the reducers expect.
7. `we:scripts/conveyor/soak/breaks/lease-reaper-graphql-unattributed.mjs` — The soak test should write two distinct fixtures—one in GraphQL shape for the `pr list` fallback, and one in genuine REST shape for the `api` path.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2902@ffa521d2fdabbeb4c688d457ee8e48a95d38ab6b

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
