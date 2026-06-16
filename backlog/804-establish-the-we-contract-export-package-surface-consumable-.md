---
type: decision
workItem: story
size: 5
status: open
blockedBy: ["730"]
dateOpened: "2026-06-16"
tags: [packaging, npm-scope, we-fui-boundary, contract-export]
---

# Decide how WE exposes its standard contracts to Frontier UI as a consumable package (capability-manifest + validation-generation contract, per #730 A1)

Prerequisite blocker for the #725 webguards/webvalidation port (uncovered at claim-time, batch-2026-06-16). The #730 A1+B1+C2 ruling requires Frontier UI to import the contract halves — `capability-manifest/` and the `validation-generation` contract (`provider`/`registry`/`fieldError`/`cel`) + the `service.ts` wire-contract types — **from `@webeverything`**. That import surface **does not exist**, and *how* to create it is an unresolved packaging decision the #730 ruling presupposed but never made.

## The gap (verified 2026-06-16, batch claim-time)

- WE's package is named **`web-everything`** (unscoped), `package.json` has **no `exports` map**.
- Frontier UI has **no `@webeverything` (nor `web-everything`) dependency**.
- `capability-manifest/` and `validation-generation/` sit at the repo root, on **no published/consumable path**.

So "FUI imports the WE-resident contract" (the #730 A1/B1/C2 mechanism, and #725's reshaped scope) has nothing to import from.

## The fork — how does WE expose contracts to FUI?

Decompose into the real sub-decisions (each needs a prepared default before ratification):

- **Package identity.** Scoped **`@webeverything/*`** (the #239 ruling: `@webeverything` = standard artifacts only; contract-specifier package names must equal published name) vs keeping the current unscoped `web-everything` and adding subpath exports. #239 leans scoped — but the live package is unscoped, so this reconciles #239 with reality.
- **Resolution mechanism.** Published-to-registry vs a **workspace link / file: dependency** for the local constellation (FUI already sits beside WE on disk). Minimize-lock-in + the npm-scope-mirrors-layer rule apply.
- **Export surface shape.** Which contract modules get an `exports` entry (capability-manifest, the validation-generation contract files per #730 B1, the #730 C2 wire-contract types) and under what subpaths — without leaking impl.

## Why a decision, not a build

The #725 port can only "copy the impl half + import the WE-resident contract" once this is settled; the packaging mechanism is a standard↔impl boundary call (touches #239 npm-scope, minimize-lock-in, protocol-is-the-only-lock), not mechanical wiring. Ratify here → the export build + the FUI dependency add become agent-ready, unblocking #725.

> Surfaced as stop-rule-4 (new design fork) during batch-2026-06-16; needs prep (survey the constellation's existing cross-repo resolution, e.g. plateau-app's `@we/*` aliases, then bold-default each sub-fork) before the call.
