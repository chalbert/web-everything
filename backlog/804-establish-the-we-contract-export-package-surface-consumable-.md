---
type: decision
workItem: story
size: 5
status: resolved
blockedBy: ["730"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-804-we-contract-export-surface.md
tags: [packaging, npm-scope, we-fui-boundary, contract-export]
---

# Decide how WE exposes its standard contracts to Frontier UI as a consumable package (capability-manifest + validation-generation contract, per #730 A1)

**Ruling — 1a + 2a + 3a (ratified 2026-06-16).** WE exposes its contracts as **scoped
`@webeverything/*` packages, one per subsystem** (`@webeverything/capability-manifest` +
`@webeverything/validation-generation`), each a `we:package.json` + curated `exports` at its existing
root dir (1a). FUI **resolves them via local tsconfig `paths` + vite `alias` into the sibling
`../webeverything` dir, keyed on the full `@webeverything/*` specifier — no registry publish** (2a);
publishing is a later, separately-prioritized build triggered by the first external consumer. The
`exports` map **lists only the WE-resident contract modules and excludes impl by omission** (3a) —
capability-manifest whole; validation-generation `provider`/`registry`/`fieldError`/`cel` +
`service`-wire-types-only; no `crossField`/`adapters/*`/`service`-handler entry, so Node `exports`
semantics make impl physically unresolvable and enforce the #730 split mechanically. Red-team (the
"alias ≠ real package, violates #239 publish-resolvability" counter) failed: import sites carry the
publish-ready scoped name, so publish is deferred not foreclosed. Implementation graduated to the
agent-ready build **#814** (which #725 now depends on).

Prerequisite blocker for the #725 webguards/webvalidation port (uncovered at claim-time, batch-2026-06-16). The #730 A1+B1+C2 ruling requires Frontier UI to import the contract halves — `capability-manifest/` and the `validation-generation` contract (`provider`/`registry`/`fieldError`/`cel`) + the `we:service.ts` wire-contract types — **from `@webeverything`**. That import surface **does not exist**, and *how* to create it is an unresolved packaging decision the #730 ruling presupposed but never made.

## The gap (verified 2026-06-16, batch claim-time)

- WE's package is named **`web-everything`** (unscoped), `we:package.json` has **no `exports` map**.
- Frontier UI has **no `@webeverything` (nor `web-everything`) dependency**.
- `capability-manifest/` and `validation-generation/` sit at the repo root, on **no published/consumable path**.

So "FUI imports the WE-resident contract" (the #730 A1/B1/C2 mechanism, and #725's reshaped scope) has nothing to import from.

## Prepared — grounding

Prep done 2026-06-16 (see `relatedReport`). **The decisive finding:** the constellation resolves
cross-repo code through **neither npm-publish nor `file:`/`link:`/`workspace:` deps** — it uses
**build-tool path aliases into the sibling dir**, declared in both tsconfig `paths` and vite `alias`.
plateau-app already resolves WE this way: `"@we/plugs/*": ["../webeverything/plugs/*"]` (tsconfig) +
`'@we/plugs': join(weRoot, 'plugs')` (vite); FUI is fully self-contained today (no WE edge). So a
proven, zero-publish, zero-lock-in mechanism is in production — but plateau's prefix is the short
`@we/*`, whereas #239 requires the contract specifier to equal the **published name** (`@webeverything/*`).

Grounding rulings — all resolved: **#239** (`@webeverything/*` = standard artifacts only; package name =
contract specifier = published name), **#730** (A1+B1+C2 per-file placement: capability-manifest whole +
`validation-generation` contract files + `we:service.ts` wire-contract types → WE; impl → FUI), **#091**
(constellation layering), **minimize-lock-in / protocol-is-the-only-lock**.

## The fork — how does WE expose contracts to FUI? (3 sub-forks, each bold-defaulted)

### Fork 1 — Package identity → **1a: scoped `@webeverything/*`, one package per contract subsystem**

- **1a (default)** — `@webeverything/capability-manifest` + `@webeverything/validation-generation`, each
  a `we:package.json` + `exports` added to its existing root dir. #239-aligned (name = specifier), matches
  physical layout + the #239 separate-scoped-contract-package precedent. The unscoped `web-everything`
  root stays the docs-site dev project, untouched.
- 1b — keep unscoped `web-everything` + subpath exports. *Rejected:* a standard contract under an
  unscoped name contradicts #239's name-equals-specifier rule.
- 1c — single umbrella `@webeverything/contracts` with subpaths. *Viable alt* (fewer package.jsons) but
  couples two independently-versionable specs; diverges from the #239 one-package-per-contract precedent.

### Fork 2 — Resolution mechanism → **2a: local tsconfig+vite alias into the sibling dir (no publish)**

- **2a (default)** — FUI adds tsconfig `paths` + vite `alias` mapping the **full** specifiers
  `@webeverything/capability-manifest` / `@webeverything/validation-generation` → `../webeverything/<dir>`.
  Mirrors plateau-app's proven mechanism but with publish-ready specifiers, so when an external consumer
  later forces a publish, the aliases drop and resolution falls through to `node_modules` with **zero
  import-site churn**.
- 2b — publish to the npm registry + real `dependency`. *Rejected for now:* a publish/version-pin lock
  the constellation has deliberately avoided; no external consumer exists. File the publish plumbing as a
  separately-prioritized build, triggered by the first external consumer.
- 2c — `file:`/`link:`/`workspace:` dep. *Rejected:* the constellation uses none; still needs an
  `exports`-resolvable build + install step, buying nothing over the alias.

### Fork 3 — Export surface shape → **3a: curated subpath exports; impl excluded by omission**

- **3a (default)** — `exports` lists **only** the WE-resident contract: `@webeverything/capability-manifest`
  → whole plane (its `we:index.ts`, A1); `@webeverything/validation-generation` subpaths `provider`,
  `registry`, `fieldError`, `cel`, `service` (**wire-contract types only**, C2). **No** entry for
  `crossField`, `adapters/*`, or the `service` handler — Node `exports` semantics make omitted subpaths
  physically unresolvable, so omission *enforces* the #730 boundary mechanically. *Implies downstream
  (agent-ready after ratification):* split `we:service.ts` so only the wire types export from WE (handler
  ports to FUI under #725); export the `.ts` source (constellation aliases resolve `.ts` directly — no
  build step for local dev).
- 3b — barrel export of each full `we:index.ts`. *Rejected:* re-exports impl through the contract surface,
  re-merging what #730 B1/C2 split.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — package identity | **1a: scoped `@webeverything/*`, one pkg per subsystem** | 1c: single umbrella pkg | high |
| 2 — resolution mechanism | **2a: local tsconfig+vite alias into sibling dir, full specifier, no publish** | 2b: publish to registry | high |
| 3 — export surface shape | **3a: curated subpath exports; impl excluded by omission** | 3b: barrel export | high |

**Distinguishing test:** expose the *standard contract* under its *publish-ready scoped name*, resolve it
with the *lowest-lock-in mechanism the constellation already proves*, and let *omission* enforce the #730
impl boundary. Publishing is a later separately-prioritized build, not a branch of this decision.

## Why a decision, not a build

The #725 port can only "copy the impl half + import the WE-resident contract" once this is settled; the
packaging mechanism is a standard↔impl boundary call (touches #239 npm-scope, minimize-lock-in,
protocol-is-the-only-lock), not mechanical wiring. Ratify here → the export build + the FUI alias add
become agent-ready, unblocking #725.

## Progress

- **Status:** resolved — ratified 1a+2a+3a (2026-06-16)
- **Branch:** docs/standard-authoring-workflow
- **Done:** surveyed the constellation's cross-repo resolution (plateau-app/FUI/WE); confirmed the gap
  (no exports map, no FUI→WE edge); published `relatedReport`; bold-defaulted all 3 sub-forks; ratified
  1a+2a+3a and recorded the ruling; scaffolded the implementation build #814 and rewired #725's
  `blockedBy` 804→814.
- **Next:** none for this decision. Implementation is #814 (agent-ready); it unblocks #725.
- **Notes:** surfaced as stop-rule-4 (new design fork) during batch-2026-06-16.
