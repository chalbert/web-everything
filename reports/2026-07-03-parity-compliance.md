# Design-system parity compliance scores (#2024)

**Program:** reproduction-conformance (#1226 / #1225) — *"the difference between any two top design
systems is theme tokens + intents and nothing else."*
**Harness:** `frontierui:plugs/webtheme/conformanceHarness.ts` `scoreFlavor` — a single, target-agnostic
scorer. All target knowledge is the WE-owned reference sets (`we:design-systems/*.reference.json`); there
is **no per-system code** (the #2024 acceptance-2 proof is the two flavors below scored through the *same*
function). The scorer reuses the #2017 manifest loader, so the scoring path is the injection path — not a
parallel re-implementation.
**Flavor data (WE-owned):** for each flavor, a `we:design-systems/` manifest + its DTCG token sidecar
+ reference set (`.designsystem` / `.tokens` / `.reference` JSON).
**Re-derivable:** `we:scripts/parity-conformance.mjs` (`npm run parity:score`) re-emits this report;
`npm run parity:check` fails the gate on drift.

> A role scores as *reproduced* only when its DTCG path both bridges to a legacy slot AND that slot is
> aliased (so a scoped override reaches the `var(--…)` a component reads — #2026/#2049) AND the resolved
> value actually differs from the platform default — a token-name lookalike or a no-op override never
> inflates the score (the naming-fork precedent). Everything else is a gap: the concrete increment the
> reproduction-conformance standard (#1226) must grow.

## Summary

| flavor | compliance | reproduced / total |
| --- | --- | --- |
| shadcn/ui | 54% | 7 / 13 |
| Material 3 (seed) | 60% | 3 / 5 |
| IBM Carbon v11 | 90% | 9 / 10 |

> Flavor data: `we:design-systems/shadcn.*`.

## Compliance score — shadcn/ui

**Overall: 54%** (7/13 reference roles reproduce onto a rendered component through theme tokens + intents).

| component | score | reproduced | roles |
| --- | --- | --- | --- |
| button | 40% | 2/5 | ✓ --primary, ✓ --radius (md), ✗ --ring, ✗ --secondary, ✗ --destructive |
| input | 33% | 1/3 | ✓ --border, ✗ --input, ✗ --ring |
| card | 80% | 4/5 | ✓ --card (surface), ✓ --radius (lg), ✓ --border, ✓ --muted-foreground, ✗ --muted |

### Gap list — roles the tokens+intents model cannot express onto a component

| component | role | DTCG path | missing link |
| --- | --- | --- | --- |
| button | --ring | ring → color | no-bridge-row |
| button | --secondary | color → secondary | no-bridge-row |
| button | --destructive | color → destructive | no-bridge-row |
| input | --input | surface → input | no-bridge-row |
| input | --ring | ring → color | no-bridge-row |
| card | --muted | surface → muted | no-bridge-row |


---

> Flavor data: `we:design-systems/material-like.*`.

## Compliance score — Material 3 (seed)

**Overall: 60%** (3/5 reference roles reproduce onto a rendered component through theme tokens + intents).

| component | score | reproduced | roles |
| --- | --- | --- | --- |
| button | 50% | 1/2 | ✓ md.sys.color.primary, ✗ md.sys.state.layer |
| card | 67% | 2/3 | ✓ md.sys.color.surface, ✓ md.sys.shape.corner-lg, ✗ md.sys.elevation.level1 |

### Gap list — roles the tokens+intents model cannot express onto a component

| component | role | DTCG path | missing link |
| --- | --- | --- | --- |
| button | md.sys.state.layer | color → state-layer | no-bridge-row |
| card | md.sys.elevation.level1 | color → tonal-elevation | no-bridge-row |


---

> Flavor data: `we:design-systems/carbon.*`.

## Compliance score — IBM Carbon v11

**Overall: 90%** (9/10 reference roles reproduce onto a rendered component through theme tokens + intents).

| component | score | reproduced | roles |
| --- | --- | --- | --- |
| button | 67% | 2/3 | ✓ $interactive, ✓ $layer-01 (surface), ✗ $font-family-sans-serif |
| input | 100% | 3/3 | ✓ $border-subtle-01, ✓ $text-primary, ✓ $layer-01 |
| card | 100% | 4/4 | ✓ $layer-01 (card surface), ✓ $border-subtle-01, ✓ $radius (none), ✓ $text-secondary |

### Gap list — roles the tokens+intents model cannot express onto a component

| component | role | DTCG path | missing link |
| --- | --- | --- | --- |
| button | $font-family-sans-serif | type → font-family | no-bridge-row |

