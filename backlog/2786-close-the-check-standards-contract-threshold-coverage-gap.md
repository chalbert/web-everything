---
bornAs: x2rosdy
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

## Design

The whole change lands on two files that already exist and already carry the mirror pattern this item
generalizes.

**The seam.** `we:scripts/lib/__tests__/check-standards.conformance.test.mjs` has three `describe` blocks:
a shape pass over `CONTRACT.enforcement.flags` + `CONTRACT.thresholds`, a value pass that pins each entry's
`value` to the live export named in its `impl`, and one coverage block —
`describe('coverage conformance — no enforcement knob escapes the contract')` — whose single `it` filters
`Object.keys(rules)` by `k.endsWith('_ENFORCED')` and asserts each is declared. That filter is both halves of
this item: it is why the *threshold* class has no guard at all (fix 1), and it is the name-suffix key that a
knob under any other name escapes (fix 2). Add the second coverage `it` beside it in the same block.

**What is actually undeclared today** (verified against `we:scripts/check-standards-rules.mjs` on this tree —
the card's original list was written before `mandateFenceAllowedParams` was added, so `thresholds` now holds
three entries, not two). Hard-error allowed-sets the engine exports and the contract does not declare:

| export | line | verdict site |
|---|---|---|
| `BACKLOG_KINDS` | `we:scripts/check-standards-rules.mjs:47` | `err(…invalid kind…)`, same file ~L187 |
| `BACKLOG_STATUSES` | `we:scripts/check-standards-rules.mjs:24` | `err(…invalid status…)`, ~L189 |
| `PARKED_REASONS` | `we:scripts/check-standards-rules.mjs:36` | `err(…invalid parkedReason…)`, ~L196 |
| `LIFECYCLE` | `we:scripts/check-standards-rules.mjs:890` | `validateStatusEnum`, ~L942 |
| `PROJECT_TIERS` | `we:scripts/check-standards-rules.mjs:957` | `validateProjectTier`, ~L971 |
| `STANDARD_ENTITY_KINDS` | `we:scripts/check-standards-rules.mjs:69` | entity-kind admission, ~L73 |
| `LOCK_POINT_CODE_LINES_THRESHOLD` | `we:scripts/check-standards-rules.mjs:2382` | `codeLinesThreshold` default, ~L2485 |

That list is the *evidence* the gap is real; it is deliberately NOT the fix — hand-copying it into the
contract closes today's instance and leaves tomorrow's knob uncovered, which is exactly the shape fix 2 exists
to prevent.

**Generalizing the key — the fork the implementing lane must rule, stated so it is not re-derived.** The
guard cannot keep asking "does the symbol name end in `_ENFORCED`". Two shapes:

- **(a) an explicit governed-set export** — the engine exports the names it considers definition-of-green, the
  guard walks that. Cheap, but self-referential: a knob omitted from the set escapes both the contract *and*
  the guard, which is the same hole under a new name.
- **(b) total coverage with an explicit engine-tier exemption list in the contract** — the guard walks EVERY
  exported constant and requires each to be either declared in `enforcement`/`thresholds` or named in a new
  `engineTier: []` array in `we:scripts/check-standards.contract.json`. Nothing escapes silently; adding a
  knob forces a contract edit either way, and the contract is on the trust-chain policy tier
  (`we:scripts/lib/gate-config.mjs`) so that edit forces `review:human`.

(b) is the shape that actually satisfies the card's "make the contract total"; (a) is listed because it is the
cheaper build and the implementing lane should reject it on the record rather than discover it.

**The other arm of fix 1.** If (b) is judged too broad for a size-2, the honest alternative is fix 1(a):
narrow the `summary` field's completeness claim in `we:scripts/check-standards.contract.json` from
"every such knob is declared HERE" to a flags-only guarantee. That is a real close of the soundness gap (the
contract stops over-claiming) and it is *doc-only* — so an item that ships only 1(a) has no tier-1 criterion
and must say so.

## Done when

1. `npx vitest run check-standards.conformance` fails on the tree BEFORE the
   contract entries are added and passes after — i.e. the new coverage `it` is red against today's
   `we:scripts/check-standards.contract.json`, which is what proves it is testing the engine and not itself.
   (Tier 1.)
2. A mutation check, run by hand once and recorded in the PR body: adding a throwaway
   `export const FOO_ALLOWED = new Set(['a']);` to `we:scripts/check-standards-rules.mjs` turns `npx vitest run check-standards.conformance` RED with a message naming `FOO_ALLOWED`; removing it turns it green again. This is the
   criterion that separates fix 2 (generalized key) from a hand-copied list — a suffix-keyed guard stays green
   through it. (Tier 1.)
3. A one-line `node -e` read of `we:scripts/check-standards.contract.json` shows every symbol in the Design
   table above resolved: present in `thresholds` (or in the `engineTier` exemption array, if fork (b) is
   taken). One cheap command, no judgment. (Tier 2.)
4. The `summary` string in `we:scripts/check-standards.contract.json` no longer claims completeness the suite
   does not enforce — either the claim is backed by the new guard, or it is narrowed to flags-only. Read the
   `summary` field's "every such knob is declared HERE" sentence. (Tier 3.)
