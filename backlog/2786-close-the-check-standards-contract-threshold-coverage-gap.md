---
bornAs: x2rosdy
kind: story
size: 2
status: active
dateOpened: "2026-07-28"
dateStarted: "2026-09-01"
tags: []
scope:
  - we:scripts/check-standards.contract.json
  - we:scripts/check-standards-rules.mjs
  - we:scripts/lib/__tests__/check-standards.conformance.test.mjs
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

## Progress

Took option (b) — the stronger close. `we:scripts/check-standards-rules.mjs` gained `THRESHOLD_KNOBS`,
a hand-maintained registry of every hard-error allowed-set/bound export (thresholds are heterogeneous
in type, so unlike enforcement flags they can't be auto-discovered), plus a derived `LOCUS_NAMES`
export (the key-set slice of `LOCI` that's actually the gate boundary — its per-locus `gateCommand`/
`devServerProbe` are operational routing, not a threshold). The contract gained 11 new `thresholds`
entries: `backlogKinds`, `backlogStatuses`, `parkedReasons`, `standardEntityKinds`, `lifecycleStates`,
`projectTiers`, `capPolyfillClasses`, `referenceRuntimeForms`, `locusNames`, `tierStates`,
`libraryTierStates` (version bumped to 2). `we:scripts/lib/__tests__/check-standards.conformance.test.mjs`
gained a threshold coverage guard (mirroring the enforcement one) plus a reverse check (no contract
entry is un-registered).

Also closed fix 2 (generalize the coverage key): the enforcement-flag discovery switched from a
`_ENFORCED` name-suffix match to `typeof export === 'boolean'` — type-based, name-agnostic, verified
the two sets are currently identical (11 booleans = 11 `_ENFORCED` exports). Threshold discovery stays
registry-based by necessity (heterogeneous types defeat a type predicate); this is documented as a
deliberate, hand-maintained declaration, not a heuristic. The one gap neither strategy closes — a
boolean/bound inlined at its call site with no named export — is documented as an accepted residual in
both the registry's doc comment and the contract summary.

Verified the new coverage guard actually fires (not just value-pinning) by transiently adding an
undeclared engine export and confirming the suite reds, then reverting.

**Adversarial review round 1** found the new `THRESHOLD_KNOBS` registry itself omitted three
unconditional hard-error constants that gate the #2089 polyglot-widening start-gate —
`PILOT_EVIDENCE_NUMS`, `POLYGLOT_WIDENING_TAG`, `POLYGLOT_CARVEOUT_TAGS` — plus (medium confidence)
`STRANDED_HASH_GRACE_SECONDS` (the error/warning boundary for a stranded backlog hash) and (worth a
look) `MATURITY_TRIGGER_RE` (a regex bound gating a hard error, previously unrepresentable in the
value-comparison helper). All five were real, unconditional-hard-error knobs by the registry's own
stated criterion — fixed: added to `THRESHOLD_KNOBS`, added matching contract entries
(`pilotEvidenceNums`, `polyglotWideningTag`, `polyglotCarveoutTags`, `strandedHashGraceSeconds`,
`maturityTriggerPattern`), and extended the conformance suite's value comparator to compare a `RegExp`
export against its `.source` string. Also softened the registry's doc comment, which had overclaimed
"every entry is hard-error-only" — the pre-existing `DIGEST_MAX_WORDS` is actually warn-only; now
documented as the one acknowledged exception. Suite re-verified green (7/7) after the fix.

**Adversarial review round 2** (fresh subagent, no memory of round 1's findings) confirmed the round-1
fix landed correctly (values byte-match, the `RegExp` branch is correctly oriented, 7/7 green), then
swept the ~3900-line engine again and found seven MORE unconditional-hard-error / enforcement-flag-
companion knobs still missing: `PLUG_SHARED_CORE_FILES` (companion of `PLUG_DRIFT_ENFORCED`),
`WEBEVERYTHING_PUBLISHED_SCOPE` (companion of `RENDERERS_PUBLISH_ENFORCED`), `MODULE_RESOLUTION_LOCKED_SCOPE`,
`DERIVED_ARTIFACT_DIRS`, `PLAYWRIGHT_CONTAINER_PIN_REQUIRED_FILES`, `GITHOOK_ALL_ALLOW` (all four
unconditional hard errors, no flag), and (lower confidence) `GRADUATED_REF` (a regex whose NARROWING,
not widening, is the loosening direction — it exempts more `graduatedTo` values from resolution
checking). All seven verified directly against source and added to `THRESHOLD_KNOBS` + the contract
(as `pluginSharedCoreFiles`, `webeverythingPublishedScope`, `moduleResolutionLockedScope`,
`derivedArtifactDirs`, `playwrightContainerPinRequiredFiles`, `githookAllAllow`, `graduatedRefPattern`).
The review also confirmed `SITE_SURFACE_MATCHERS`/`STANDARD_SURFACE_MATCHERS` gate a hard error the
same way but are arrays of arrow-function predicates — not JSON-representable, so this registry
mechanism cannot govern them; documented as an explicit, named residual limitation (not a missed entry)
in `THRESHOLD_KNOBS`'s doc comment rather than silently left out. Suite re-verified green (7/7).

Two review rounds of manual grep sweeps kept finding MORE missed knobs rather than converging, so
rather than trust a third manual sweep, did an EXHAUSTIVE programmatic one: enumerated all 52
non-function exports from `we:scripts/check-standards-rules.mjs` (`Object.keys(rules).filter(k =>
typeof rules[k] !== 'function')`) and individually classified every one — in `THRESHOLD_KNOBS`, a
boolean enforcement flag, or explicitly excluded with a reason. Four more turned up unclassified:
`FILE` (descriptor-location metadata, never compared for pass/fail — excluded), `LOCI` (superseded by
the already-registered `LOCUS_NAMES` key-set proxy — excluded), `RESEARCH_REVIEW_HORIZON_DEFAULT`
(warn-only default, only appears in an error-message EXAMPLE string, never a comparison bound —
excluded), `STATUS_SYNONYMS` (changes which of two hard-error MESSAGES a deprecated status gets, never
whether the gate passes or fails — excluded), and one genuine miss: `SURFACE_ZONE_PREFIXES` (the
plain-string-array scope companion of the SITE/STANDARD_SURFACE_MATCHERS pair above — narrowing it
exempts paths from classification entirely; JSON-representable unlike its matcher siblings, so added
as `surfaceZonePrefixes`). The programmatic sweep script confirms zero remaining unclassified exports.
Suite re-verified green (7/7) after the fix.

**Adversarial review round 3** independently re-derived the full 52-export enumeration from the live
module (not trusting this note's counts), spot-checked the `STATUS_SYNONYMS`/`LOCI`/`SURFACE_ZONE_PREFIXES`
reasoning directly against source, checked for re-export aliasing this enumeration method could
structurally miss (none found — `we:scripts/lib/research-freshness.cjs` has exactly the three bindings
already accounted for), and stress-tested the warn-only exclusions again independently. Found nothing new.
Converged: `THRESHOLD_KNOBS` is complete modulo the one documented, structurally-forced residual
(`SITE_SURFACE_MATCHERS`/`STANDARD_SURFACE_MATCHERS`). 7/7 green.
