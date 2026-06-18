# #804 — How WE exposes its standard contracts to Frontier UI as a consumable package (prep artifact)

**Date:** 2026-06-16 · **Decision:** [#804](../backlog/804-establish-the-we-contract-export-package-surface-consumable-.md) · **Blocks:** #725 (FUI port of `webguards`/`webvalidation`) · **Presupposed by:** [#730](../backlog/730-constellation-placement-of-capability-manifest-validation-ge.md) ruling A1+B1+C2

The #730 ruling decided **which layer owns each file** (`capability-manifest/` whole + the
`validation-generation` contract files → WE standard; impl → FUI) and instructed FUI's ported
`webvalidation` to **import the WE-resident contract from `@webeverything`**. But that import surface
**does not exist** — WE's package is unscoped `web-everything` with no `exports` map, FUI has no WE
dependency, and the contract dirs sit at the repo root on no consumable path. This decision settles the
*packaging mechanism* the #730 ruling presupposed: identity, resolution, and export shape.

No greenfield design → no web/prior-art survey. The grounding is the **constellation's real cross-repo
resolution** (traced 2026-06-16) classified against already-ratified rulings: **#239** (`@webeverything/*`
= standard artifacts only; package name = contract specifier = published name), **#091** (managed-offering
constellation layering), the **minimize-lock-in / protocol-is-the-only-lock** rule, and the **#730** A1+B1+C2
per-file placement.

## The gap (verified 2026-06-16, batch claim-time)

- WE root `we:package.json` — `name: "web-everything"` (unscoped), **no `exports` map**, no
  `main`/`module`/`types`, no `workspaces` ([we:package.json:2](../package.json#L2)).
- `capability-manifest/` — 6 files, **no we:package.json**; `we:index.ts` already re-exports the whole plane
  (`provider`/`fixtures`/`guard`/`report`/`check`) ([we:index.ts](../capability-manifest/index.ts)).
- `validation-generation/` — 11 files, **no we:package.json**; **mixes contract and impl** in one dir:
  contract = `provider`/`registry`/`fieldError`/`cel` + the `we:service.ts` wire-contract types (→ WE per
  #730 B1/C2); impl = `we:crossField.ts` + `adapters/*` + the `we:service.ts` handler (→ FUI).
- Frontier UI — **no `web-everything`/`@webeverything` dependency** anywhere; tsconfig + vite aliases are
  all *internal* (`@core/*`, `@webcomponents/*` → its own `plugs/*`).

## The decisive finding — how the constellation actually resolves cross-repo code

The constellation uses **neither npm-published packages nor `file:`/`link:`/`workspace:` deps**. Sibling
repos resolve each other purely through **build-tool path aliases into the sibling directory** — declared
twice, in tsconfig `paths` (for typecheck) and vite `alias` (for bundling):

| Consumer | Mechanism | Evidence |
|---|---|---|
| plateau-app → WE | tsconfig `paths` + vite `alias` into `../webeverything` | `"@we/plugs/*": ["../webeverything/plugs/*"]`, `"@we/blocks/*": [...]` (we:tsconfig.json); `'@we/plugs': join(weRoot, 'plugs')` (vite.config.mts) |
| plateau-app → FUI | vite `alias` into `../frontierui` | `'@frontierui/webdocs-ui': join(fuiRoot, 'fui:packages/webdocs-ui/src/index.ts')` |
| FUI (internal) | self-contained aliases only | `@webcomponents/*` → `plugs/webcomponents/*` — no external edges |

So there is a **proven, zero-publish, zero-lock-in resolution pattern already in production**: a path
alias from the consumer's tsconfig+vite into the sibling repo, with import sites written against a stable
specifier. No registry, no install step, no version pinning. The catch: plateau-app's alias prefix is the
**short `@we/*`**, while #239 requires the contract import specifier to equal the **published name**
(`@webeverything/*`) — so the contract consumption should alias the *full* specifier, not borrow the
`@we/*` shorthand (which today only fronts impl-ish `plugs/blocks` dev consumption, not publish-bound
contracts).

## The forks, classified

### Fork 1 — Package identity → **scoped `@webeverything/*`, one package per contract subsystem**

#239 is dispositive: standard artifacts publish under `@webeverything/*`, and the package name doubles as
the contract specifier — name must equal published name to be publish-resolvable. The contract dirs are
standard artifacts (#730 placed them in WE), so they take `@webeverything/*` identity. Two natural
packages matching the existing physical layout: **`@webeverything/capability-manifest`** and
**`@webeverything/validation-generation`** — add a `we:package.json` + `exports` to each existing root dir.
The unscoped `web-everything` root stays the eleventy/vite *docs-site* dev project (not a publishable
contract), untouched.

- **1a (default)** — scoped `@webeverything/*`, **one package per subsystem**, co-located at the existing
  root dirs. #239-aligned (name = specifier), matches physical layout, mirrors the #239 precedent of
  separate scoped contract packages.
- 1b — keep unscoped `web-everything` + subpath exports (`web-everything/capability-manifest`).
  *Rejected:* a standard contract under an unscoped name contradicts #239's name-equals-specifier rule and
  reserves nothing; the eventual published specifier would not be `@webeverything/*`.
- 1c — a single umbrella `@webeverything/contracts` with both subsystems as subpaths. *Viable
  alternative* (fewer package.jsons) but couples two independently-versionable specs into one publish unit
  and diverges from the #239 one-package-per-contract precedent. Defer unless the two-package overhead
  bites.

### Fork 2 — Resolution mechanism → **local build-tool path alias into the sibling dir (no publish)**

The survey shows the only working constellation pattern is the build-tool alias; publishing has never been
exercised. Minimize-lock-in says don't introduce a registry/version-pin step before an external consumer
needs it.

- **2a (default)** — FUI adds tsconfig `paths` + vite `alias` mapping the **full** specifiers
  `@webeverything/capability-manifest` / `@webeverything/validation-generation` →
  `../webeverything/<dir>we:/index.ts` (or the curated entry). Mirrors plateau-app's proven mechanism but
  with publish-ready specifiers. **Import sites are written against the real scoped name**, so when an
  external consumer eventually forces a publish, the aliases drop and resolution falls through to
  `node_modules` with **zero import-site churn**.
- 2b — publish to the npm registry + add a real `dependency`. *Rejected for now:* introduces a
  publish/version-pin lock the constellation has deliberately avoided; no external consumer exists.
  Becomes correct the moment one does — file as a separately-prioritized build, not this fork's branch.
- 2c — `file:`/`link:`/`workspace:` dependency. *Rejected:* the constellation uses none of these; a
  `file:` dep still needs an `exports`-resolvable build and an install step, buying nothing over the alias
  while diverging from the established pattern.

### Fork 3 — Export surface shape → **curated subpath exports; impl excluded by omission**

The #730 split is only real if the package surface **cannot** import impl. Node `exports` semantics make
omitted subpaths physically unresolvable — so a curated map *enforces* the boundary mechanically, not by
convention.

- **3a (default)** — curated `exports` listing **only** the WE-resident contract modules:
  - `@webeverything/capability-manifest` → the whole plane (its `we:index.ts`; A1 keeps it cohesive).
  - `@webeverything/validation-generation` subpaths: `provider`, `registry`, `fieldError`, `cel`, and
    `service` (**wire-contract types only**, per C2). **No** `exports` entry for `crossField`, `adapters/*`,
    or the `service` handler — they are un-importable from the package even while they physically remain in
    the dir until #725 ports them out.
  - *Builds this implies (downstream, agent-ready after ratification):* split `we:service.ts` so only the
    wire-contract types are exported from WE (the handler ports to FUI under #725); pick `.ts`-source vs a
    built `dist/` as the export target (default: point at `.ts` source — the constellation aliases resolve
    `.ts` directly, no build step needed for local dev).
- 3b — single barrel export of each subsystem's full `we:index.ts`. *Rejected:* re-exports impl
  (`crossField`, `adapters`, the handler) through the contract surface — re-merges exactly what #730 B1/C2
  split, an impl-leak into a `@webeverything/*` package.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — package identity | **1a: scoped `@webeverything/*`, one package per subsystem** | 1c: single umbrella package | high |
| 2 — resolution mechanism | **2a: local tsconfig+vite alias into sibling dir, full specifier, no publish** | 2b: publish to registry | high |
| 3 — export surface shape | **3a: curated subpath exports; impl excluded by omission** | 3b: barrel export | high |

**Distinguishing test across all three:** expose the *standard contract* under its *publish-ready scoped
name*, resolve it with the *lowest-lock-in mechanism the constellation already proves*, and let *omission*
enforce the #730 impl boundary. Publishing is a later, separately-prioritized build triggered by the first
external consumer — not a branch of this decision.

## What ratifying this unblocks

#725 re-shapes to: add the two `@webeverything/*` `we:package.json` + `exports` maps in WE; add the
FUI-side tsconfig+vite aliases; split `we:service.ts`; then #725 copies the impl half and imports the
WE-resident contract by its scoped name. #725 is `blockedBy` this decision (and #649, #730).
