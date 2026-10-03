---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/lib/lane-salvage.mjs", "we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs", "we:scripts/lib/__tests__/lane-salvage.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a reclaimFinishedLanes test with salvageEnabled:true, reclaimPreserved:true that asserts salvage ca… (from chalbert/web-everything#3676 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/lane-pool-health-watch.mjs:537` — Add a `reclaimFinishedLanes` test with `salvageEnabled:true, reclaimPreserved:true` that asserts salvage candidates are still processed. Better, make the preserved pass a separate function so the flag cannot gate the salvage block.
2. `we:scripts/conveyor/lane-pool-health-watch.mjs:497` — Add a test with a stale-lease, dead-holder `finished-reclaimable` row that expects reclaim. Filter on `row.holderAlive` or a fresh-lease check, not `row.lease`.
3. `we:scripts/lib/lane-salvage.mjs:372` — Add a `laneLivenessGate` unit test with a malformed lease file (an ENOENT-versus-other-error table test) so the fail-closed contract is defended.
4. `we:scripts/conveyor/lane-pool-health-watch.mjs:537` — Add a table-driven test that crosses `reclaimPreserved` with `salvageEnabled` and asserts which reclaim modes are allowed. More generally, a review lens that requires a named test for each "never X" comment.
5. `we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs:852` — Extend the parameterized recovery test with salvageEnabled: true and an otherwise eligible unpreserved salvage candidate; assert that no salvage call occurs. This deterministic regression test must fail if the !reclaimPreserved guard is removed.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3676@b4a98fd08dc24b44c16d789dc2836c55b0107a58

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
