---
kind: story
size: 2
status: open
dateOpened: "2026-07-28"
tags: []
---

# Close the check:standards contract threshold-coverage gap

The #2769 definition-of-green contract governs the 9 `*_ENFORCED` enforcement flags fully (declared + pinned + coverage-guarded), but its `thresholds` section declares only `FIB` + `DIGEST_MAX_WORDS` while the engine holds other hard-error allowed-sets (`BACKLOG_KINDS`, `BACKLOG_STATUSES`, `PARKED_REASONS`, `STANDARD_ENTITY_KINDS`, …). No coverage guard exists for the threshold class, so loosening one stays agent-clearable and the contract summary over-claims "every such knob is declared HERE."

## Origin

Surfaced during the human review of **PR #907** (`/review 907` — the #2769 gate-self PR). The core diff was accepted (all enforcement flags mirror the live engine and are coverage-guarded, tier classification sound, no trust-chain hole). This item captures the two non-blocking gaps the review found, both in the threshold half — not regressions (those allowed-sets were agent-clearable before too), but a soundness gap between the contract's advertised completeness and what the conformance suite enforces.

## Two fixes

1. **The threshold half is under-governed.** Either (a) narrow the contract summary's completeness claim to a **flags-only** guarantee (honest scope), or (b) extend `we:scripts/lib/__tests__/check-standards.conformance.test.mjs` with a **threshold coverage guard** that fails when the engine gains a hard-error allowed-set the contract doesn't declare — mirroring the existing `*_ENFORCED` coverage test. Option (b) is the stronger close and matches #2769's original intent.
2. **The coverage guard keys on the `_ENFORCED` name suffix**, so a future enforcement knob under any other name (or an inlined boolean) escapes both the contract and the guard. Generalize the key.

## Refs

- Precedent / parent ruling: **#2625** (contract-split for tier ownership, fork (d)); shipped by **#2769**.
- Artifacts: `we:scripts/check-standards.contract.json`, `we:scripts/lib/__tests__/check-standards.conformance.test.mjs`.
