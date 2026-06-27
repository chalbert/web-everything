---
kind: decision
parent: "1836"
status: open
relatedProject: webplugs
relatedReport: reports/2026-06-27-unplugged-plug-parity.md
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
tags: [plugs, packaging, npm, dedup]
---

# Decide: per-plug npm packages vs the single @frontierui/plugs monolith

Workstream W6 of [#1836](/backlog/1836-make-every-plug-public-api-functional-unplugged-parity-matri/) wants one npm package per plug so a consumer takes only the API they need; this reverses the resolved [#1045](/backlog/1045-package-frontierui-plugs-as-frontierui-plugs-dual-exports-su/) ruling that ships a single `fui:plugs/package.json` (`@frontierui/plugs`) with locked scope for cross-monorepo version dedup. The recommended ruling is **keep the monolith with subpath exports — do not reverse #1045** — because a prior-art survey of every benchmark library shows the industry has just consolidated *away* from per-package granularity, and `exports`-map subpaths + tree-shaking already deliver the minimal-install the per-plug ask was reaching for, *without* reintroducing the version-skew #1045/#1006 closed. Grounded in `/research/unplugged-plug-parity/` (session report `we:reports/2026-06-27-unplugged-plug-parity.md`).

## Digest

The packaging seam exists and is settled: `fui:plugs/package.json` ships one `@frontierui/plugs` with **8 public domain subpath exports** (`./core`, `./webregistries`, `./webinjectors`, `./webcomponents`, `./webcontexts`, `./webbehaviors`, `./webstates`, `./webexpressions`) plus `.`/`/unplugged`/`/bootstrap`, source-distributed `.ts`, resolved by sibling consumers via the `@frontierui/*` locked scope. **Every WE and plateau-app consumer already imports a deep subpath** (`@frontierui/plugs/webbehaviors/CustomAttributeRegistry`, `@frontierui/plugs/webinjectors/InjectorRoot`, …), never the monolith root — so per-plug *import granularity* is already in hand. What W6 additionally proposes is per-plug *package* granularity (independent install + independent versioning), which is a different, costlier thing: 8–20 separately-versioned packages across the WE/FUI/plateau monorepo set, the exact version-skew #1045 was ratified to prevent (exports-lock #1006).

The decision turns on one axis — *what is the distribution unit*, one package or N — grounded in the real tree and the survey:

- **The current unit and its rationale.** `fui:plugs/package.json` is one package; #1045 (resolved 2026-06-19) ratified it "for cross-monorepo version dedup" with the exports-lock #1006, on the #606 ground that plugs is FUI's and WE/plateau consume it as a no-leakage client. The plugs share runtime state at the seams (registries, contexts, injectors are consulted across plugs), so a skewed version of one against another is a *runtime* hazard, not just a bundling annoyance.
- **The minimal-*import* goal is already met; minimal-*install* for an external consumer is a separate, unproven thing.** Consumers import subpaths and a bundler tree-shakes the unused domains, so minimal *import* granularity is in hand. But the package is **source-distributed `.ts` with no build step, no published tarball, and no `sideEffects: false`** (`fui:plugs/package.json` has no `scripts` block; sibling consumers alias the bare specifier to the source tree — `we:vite.config.mts:206`). So "minimal install" today means "minimal *bundle* after the consumer's own bundler compiles FUI source in-tree" — a monorepo-sibling convenience, not a guarantee for the future external `npm install` consumer (#872/#907) the per-plug ask is really about. Per-plug packages would buy *independent install/versioning* on top of that — and independent versioning of co-dependent runtime plugs is the liability, not the feature.
- **The industry trend is unambiguous and recent** (`/research/unplugged-plug-parity/`, Survey 1): Radix consolidated per-primitive `@radix-ui/react-*` → a unified `radix-ui` umbrella; Chakra v3 collapsed many `@chakra-ui/*` → one `@chakra-ui/react`; React Aria ships `react-aria-components` as one package ("per-component packages proven to have significant overhead"). Every one cites version-skew/dedup/peer-dep pain and notes subpath exports already give minimal install. The one library that *does* sub-package — Lit — splits by **stability tier** (`@lit-labs/*`), never per-feature.

## Recommended path at a glance

| Fork | The call | Recommended default | Main alternative (excluded) |
| --- | --- | --- | --- |
| **1 — distribution unit** | One `@frontierui/plugs` package or one package per plug | **Monolith + subpath exports** (status quo #1045) — minimal *import* granularity via subpaths; one version, no inter-plug skew | Per-plug packages — *Rejected*: currently impossible (cross-domain import cycles) and reintroduces the version-skew #1045/#1006 closed; against the whole industry's consolidation |

## Fork 1 — the plug distribution unit

**Fork-existence justification (genuine either/or):** the two branches *cannot coexist* as the canonical distribution unit — a consumer's lockfile and a `blockedBy` build (#1846) resolve plugs as **either** one package **or** N independently-versioned packages; the published `@frontierui/*` surface is one shape or the other. This is a real reversal call on a ratified ruling (#1045), not a support-both — co-publishing both an umbrella *and* per-plug packages is itself a third option (c) weighed below, but the *default unit* must be picked.

**Crux** (`fui:plugs/package.json:8-20`, #1045 ruling, survey Survey 1): the minimal-install motivation for per-plug packages is already delivered by the 8 subpath exports + tree-shaking; what per-plug packages *add* is independent versioning, which is a hazard for co-dependent runtime plugs.

- **(a) Per-plug packages** (W6's ask) — one `@frontierui/plug-webbehaviors`, `…-webinjectors`, … per domain (8 public, up to 20 if all exported). *Pro:* a hypothetical external consumer installs exactly one plug. *Con (decisive — and stronger than "inadvisable": it is currently impossible):* the 8 exported domains have **dense cross-domain imports that deep-reach private files**, not just public indexes — e.g. `fui:plugs/webregistries/ScopedRegistryAttribute.ts:17` imports `../webbehaviors/CustomAttribute`, `fui:plugs/webexpressions/CustomTextNode.ts:7` imports `../webinjectors/InjectorRoot` — so no domain ships standalone without first severing those edges. Even if extracted, 8–20 independently-versioned packages that share runtime registries/contexts let a consumer pin `webbehaviors@2` against `webregistries@1` and break the seam at runtime — the exact cross-monorepo skew #1045 closed with exports-lock #1006, and the pain Radix/Chakra/React Aria *fled* by consolidating. *Rejected.*
- **(b) Monolith with subpath exports** (status quo #1045) *(recommended)* — keep one `@frontierui/plugs`; consumers import `@frontierui/plugs/<domain>` subpaths and tree-shake the rest. *Pro:* one version → zero inter-plug skew; minimal *import* granularity already delivered; matches the post-2024 industry norm and #606/#1045/#1006. *Con:* a single external consumer wanting *only* `webbehaviors` still resolves the metadata for all — a non-issue for source-distributed `.ts` siblings, and not a real consumer today (all three are monorepo siblings on one version).
- **(c) Hybrid — monolith canonical + a `-labs` stability tier** — keep (b) as the unit, and *only* split out a plug into a separate package when it is genuinely **experimental/unstable**, mirroring Lit's `@lit-labs/*` (split axis = **stability, never per-feature**). *Held as a future exception, but currently blocked-until-decoupled:* the same deep-reach cross-domain imports in (a) mean no plug is extractable today even for a `-labs` split — the prerequisite is "sever the cross-domain edges + route them through public indexes", which must be a named blocker, not a free door. So this is not a cheap escape hatch the recommendation can lean on; it is reachable only after a decoupling pass.

**Scope note (against #1836's "every plug"):** only **8 of the 20** plug directories are exported today; ~12 (`webtheme`, `webanalytics`, `webguards`, `webvalidation`, …) have **no export at all**. For those the consumer's choice isn't "monolith vs per-plug" — it's "no published access yet". The monolith ruling holds for them too, but the reframed #1846 (below) must *enumerate the unexported domains* and give each a clean subpath export, or the parity epic's "every plug functional" goal isn't actually met.

**Skeptic: SURVIVES-WITH-AMENDMENT** — the refute attempt (verified against the tree) argued the future external-publish consumer (#872/#907) is the per-plug case, and probed three claims. Two load-bearing claims were *overstated* and are corrected above: (1) "tree-shaking already delivers minimal install" — true for *import* granularity, but the package is source-distributed `.ts` with no tarball/`sideEffects` so minimal *install* for a published consumer is unproven (folded into the reframed #1846 residual); (2) option (c) `-labs` is **not** a free door — cross-domain deep-reach imports make no plug extractable today, so it is blocked-until-decoupled. The *direction* survives **more strongly**, for a partly different reason than first written: per-plug packaging is not merely skew-risky, it is currently *impossible* (the import cycles), and the industry has consolidated away from it regardless.

## Consequence for W6 / #1846

A monolith ruling **reframes** [#1846](/backlog/1846-ship-each-plug-as-its-own-npm-package/) (W6 "ship each plug as its own npm package") rather than unblocking it as written: the minimal-install goal it cites is already met by subpath exports, so #1846 should be rewritten to "verify every plug has a clean subpath export + tree-shakes independently" (a conformance check on the existing monolith), or resolved as graduated-to-#1045. The genuine per-package work survives only as the option-(c) `-labs` exception, filed if a plug's API destabilises. This is recorded here so the decision turn ratifies the reframing in the same act.

## Dependencies & lineage

- **Parent:** [#1836](/backlog/1836-make-every-plug-public-api-functional-unplugged-parity-matri/) (epic, W6). Gates [#1846](/backlog/1846-ship-each-plug-as-its-own-npm-package/).
- **Reverses-or-upholds:** [#1045](/backlog/1045-package-frontierui-plugs-as-frontierui-plugs-dual-exports-su/) (resolved — the single-package ruling) + #1006 (exports-lock) + #606 (plugs FUI-owned). Recommendation = *upholds* #1045.
- **Grounds:** `/research/unplugged-plug-parity/` Survey 1 (Radix/Chakra/React Aria/MUI/Lit packaging trend), `fui:plugs/package.json:8-20` (the 8 subpath exports), #170 (the dedup program).
