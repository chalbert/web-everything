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


One row is deliberately different in kind: `LOCK_POINT_CODE_LINES_THRESHOLD`
(`we:scripts/check-standards-rules.mjs:2382`, consumed as the `codeLinesThreshold` default ~L2485) is a
**WARN**-level threshold — its verdict site at `we:scripts/check-standards.mjs:2067` emits via `warn()`, not
`err()`. It belongs in the contract for the same reason `digestMaxWords` does (it is a tunable number whose
loosening changes what the gate says), but it is **not** a hard-error allowed-set and the table above is not
claiming it is.

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

**Size (b) before committing to it — this is the part that decides whether it fits in a size-2.**
`we:scripts/check-standards-rules.mjs` has **57** `export const` declarations, of which only ~13 are
definition-of-green knobs. Taken literally, (b) needs `engineTier` entries for the other ~40 on day one —
`FILE`, `LOCI`, `STATUS_SYNONYMS`, `HTML_ELEMENTS`, `TIER_STATES`, `LIBRARY_TIER_STATES`, `CAP_POLYFILL`,
`REFERENCE_RUNTIME_FORMS`, `PILOT_EVIDENCE_NUMS`, `POLYGLOT_CARVEOUT_TAGS`, `LOCK_POINT_COLLISIONS_THRESHOLD`
and a long tail of path/lookup maps — just to turn the suite green. That is real work and a large, low-signal
exemption list to maintain. Two ways to cut it, both to be ruled by the implementing lane rather than
discovered: narrow (b)'s walk to exported `Set`/frozen-array/number constants that a rule actually *measures a
finding against* (which drops most of the maps), or land (b) as an explicit list first and generalize once the
population is known. If neither is acceptable at this size, take fix 1(a) — the doc-only honest-scope
narrowing — and re-file the guard.

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

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion up front) — Independently re-verified: we:scripts/check-standards.contract.json's thresholds section holds 3 entries (digestMaxWords, allowedSizes, mandateFenceAllowedParams) — matching the card's own correction that its evidence predates mandateFenceAllowedParams. Re-ran `npx vitest run check-standards.conformance` (5 passing) then added a throwaway `export const FOO_ALLOWED = new Set(['a'])` to we:scripts/check-standards-rules.mjs and re-ran — the suite stayed green (did not redden), confirming the coverage `describe` block (we:scripts/lib/__tests__/check-standards.conformance.test.mjs:93-105) really does filter only `k.endsWith('_ENFORCED')` and the threshold-class gap is real, not asserted.
- **blast-radius** (NOT addressed; strategy: measure against the real corpus before wiring) — The card recommends fork (b) — 'the guard walks EVERY exported constant and requires each to be either declared... or named in a new engineTier: [] array' — as the stronger default, but never sizes that claim. we:scripts/check-standards-rules.mjs has 57 `export const` declarations; only ~13 are current enforcement/threshold knobs. Fork (b) taken literally would require immediate engineTier entries for ~40+ unrelated exports (FILE, LOCI, STATUS_SYNONYMS, PER_ID_SPEC_DIR, HTML_ELEMENTS, TIER_STATES, LIBRARY_TIER_STATES, CAP_POLYFILL, REFERENCE_RUNTIME_FORMS, PILOT_EVIDENCE_NUMS, POLYGLOT_CARVEOUT_TAGS, LOCK_POINT_COLLISIONS_THRESHOLD, and dozens of path/lookup maps) just to turn the suite green on day one — a cost the card asks the implementing lane to discover rather than measuring itself, exactly the failure mode this risk names.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Checked for consumers of we:scripts/check-standards.contract.json beyond the conformance test: we:scripts/lib/gate-config.mjs, we:scripts/lib/__tests__/review-escalation.test.mjs, we:scripts/lib/__tests__/gate-config.test.mjs, and we:scripts/lib/__tests__/gate-invariants.test.mjs all reference only the file's basename for trust-tier registration, none read the internal enforcement/thresholds schema — so adding a top-level `engineTier` key is safe and the card's Refs section already names the two files that actually need editing.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when #1 and #2 require a red-before-green vitest run plus a hand-run mutation check (add/remove a throwaway `FOO_ALLOWED` export, message must name it). I reproduced exactly that mutation against the live repo and confirmed today's suffix-keyed guard stays green (fails to redden) — the card's own proposed acceptance criterion is the correct test for the defect it targets.
- **population** (addressed; strategy: name the population each threshold guards) — The Design section's evidence table names every currently-undeclared threshold-class symbol with file, line, and verdict site; I re-verified all 7 export lines exactly against we:scripts/check-standards-rules.mjs.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when #2 requires the failure message name the offending symbol, mirroring the existing enforcement-coverage assertion's message shape (we:scripts/lib/__tests__/check-standards.conformance.test.mjs:99-102) — a future gap would surface as a named, readable failure, not a silent pass.

**Corrections applied by this review:**

- The Design table lists `LOCK_POINT_CODE_LINES_THRESHOLD` under "Hard-error allowed-sets" but its only verdict site (we:scripts/check-standards.mjs:2067) emits via `warn()`, not `err()` — it is a WARN-level threshold like the already-declared `digestMaxWords`, not a hard-error allowed-set, so the table's header characterization is inaccurate for that one row (the entry itself is still legitimately governable, just not for the stated reason).

The card's central factual claims all verify against the live repo (thresholds now holds 3 entries not 2, the coverage `describe` block filters only on the `_ENFORCED` suffix, all 7 cited export lines are exact, and a live mutation probe confirms the suffix-keyed guard stays green on a non-`_ENFORCED` hard-error export) — but the recommended fork (b) ("walk EVERY exported constant") is never sized against the ~57 `export const` declarations in `we:scripts/check-standards-rules.mjs`, most of which are unrelated helper maps/arrays that would need immediate `engineTier` exemption entries.

_Recorded through the declared `review-prep` operation._
