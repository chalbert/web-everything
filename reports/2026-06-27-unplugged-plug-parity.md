# Unplugged plug parity — delivery, packaging & residue (prep survey for #1837 / #1838 / #1839)

Prep survey backing three `kind: decision` children of epic [#1836](/backlog/1836-make-every-plug-public-api-functional-unplugged-parity-matri/) (make every plug public API functional unplugged). One shared prior-art base — the plugged/unplugged delivery model, npm packaging granularity, and capability-parity tables — feeds all three. Session artifact for `/research/unplugged-plug-parity/`.

## Ratified ground (the doctrine the three decisions sit on)

- **#606 (ratified):** the plugs **runtime is FUI-owned** (`@frontierui/plugs`); WE keeps **contracts only** (`we:src/_data/plugs/`) and the doc-site spec. Every plug must have a non-invasive **unplugged** form (the real-app surface); plugged/global-patching mode is **POC/demo only**; every plug ships dual-mode tests.
- **#1826/#1807 (ratified):** plug = a proposed missing web standard as runnable code. **Unplugged** = safe-today usage of only what the platform ships, non-invasive, enforcement-free — *the supported product surface*. **Plugged** = the proposed standard materialized as runnable code (the prollyfill / upstream candidate), carrying enforcement + polyfill. Single-substrate guardrail: plugged/unplugged is a **delivery + enforcement** axis over one contract, not two contracts (`we:docs/agent/platform-decisions.md:845`).

## Real-tree grounding

- **The two runtime forms.** `fui:plugs/unplugged.ts:1-18` — side-effect-free functional API (`register`/`unregister`/`attach`/`detach`/`upgrade`/`downgrade`, module-scoped `Map`/`WeakMap`, zero global patches). `fui:plugs/bootstrap.ts:1-11` — plugged mode, `applyPatches()` onto globals + registry singletons on `window` (`fui:plugs/bootstrap.ts:70-109`).
- **The MaaS serve seam (#1838).** `we:blocks/renderers/module-service/servePathIR.ts:138-145` — the `form` query param is catalog-gated (#662), `required:false`, "Defaults to the origin's default form"; the value set is an injected implementation catalog, not the neutral contract (`we:blocks/renderers/module-service/servePathIR.ts:91-94`). No `plugged`/`unplugged`/`mode` handling exists in the dir today. An `X-MaaS-Lossy` header already exists (`we:blocks/renderers/module-service/servePathIR.ts:57`) to mark a served form that lost information.
- **The packaging status quo (#1837).** `fui:plugs/package.json` — single `@frontierui/plugs`, **8 public domain subpath exports** (`./core`, `./webregistries`, `./webinjectors`, `./webcomponents`, `./webcontexts`, `./webbehaviors`, `./webstates`, `./webexpressions`) + `.`/`/unplugged`/`/bootstrap`. Source-distributed `.ts`, resolved by sibling consumers via the `@frontierui/*` locked scope. #1045 (resolved 2026-06-19) ratified this; **all WE/plateau-app consumers import deep subpaths**, never the monolith root. 20 plug directories exist (only 8 exported). #1006 = exports-lock for cross-monorepo dedup.
- **The parity/residue ground (#1839).** #635 audit (`we:reports/2026-06-14-plugs-runtime-audit.md:15-28`): all 10 surveyed domains *implement* both modes; only `webbehaviors` has dual-mode automated coverage. Plug contract data (`we:src/_data/plugs/customattribute.json`) is `id/name/status/type/summary/projects` — **no parity field**. No plugged-vs-unplugged parity table built yet. Method-attachment residue examples: `fui:plugs/webcontexts/Node.contexts.patch.ts:52-70` (`Node.prototype.createElement = …`), `fui:plugs/webinjectors/Node.injectors.patch.ts:101` (`Document.prototype.createElement = …`, with WeakMap tracking at `fui:plugs/webinjectors/Node.injectors.patch.ts:27`).

## Survey 1 — npm packaging granularity (#1837)

The industry has **consolidated FROM many packages TO fewer**, all citing the same pain (version-skew, dependency duplication, peer-dep/dedup hell) and all noting the only thing per-package bought — minimal install — is now delivered by `exports`-map subpaths + bundler tree-shaking:

| Library | Granularity | Trend / rationale |
| --- | --- | --- |
| Radix UI | was per-primitive `@radix-ui/react-*`; **now unified `radix-ui` umbrella** (recommended default) | Consolidated — "prevents version conflicts/duplication", tree-shakeable; update all together |
| Chakra UI | v2 many `@chakra-ui/*`; **v3 single `@chakra-ui/react`** | Consolidated (headline v3 change) — simpler install, cohesive API, less maintenance surface |
| React Aria | hooks per-pkg, but components ship as **single `react-aria-components`** | "Per-component packages proven to have significant overhead"; moving to monopackage |
| MUI | **monolith `@mui/material`** + per-component subpath exports | Subpaths are a dev-server speed win; prod tree-shaking handles size |
| Lit | **monolith `lit`** + layered `@lit/reactive-element`, `@lit-labs/*` | Split by **stability tier**, never per-feature |

**Conclusion:** keep the monolith + subpath exports (#1045 holds). Our plugs are *more* interdependent (shared runtime registries/contexts) than UI components, so version-skew risk is *higher* — exactly the failure mode the incumbents fled. The only legitimate split axis is Lit's: a `@frontierui/plugs-labs/*` stability tier, never one-package-per-plug.

## Survey 2 — capability-parity state vocabulary (#1839)

A **3-state model with a partial middle is the established norm**:

| Source | States | Middle state |
| --- | --- | --- |
| caniuse | `y` yes · **`a` almost/partial** · `n` no · `d` disabled-by-default (flag) · `p` polyfill | `a` = partial support (the canonical 3rd state); `d` = exists but needs enabling |
| MDN BCD | `version_added` true/false + **`partial_implementation` (bool) + required `notes`** + `flags` | `partial_implementation:true` MUST pair with a `notes` string explaining the divergence |
| web-features / Baseline | limited · newly · widely | maturity/recency tier, not works-with-caveat |

**Conclusion:** our `works / works-with-caveat / plugged-only` maps cleanly — `works`≈caniuse `y`, `works-with-caveat`≈caniuse `a` / BCD `partial_implementation`, `plugged-only`≈caniuse `d` (flag/plug-gated). Borrow BCD's discipline: **the caveat state must carry a required note**. The survey's sharp point: plugged-only is structurally caniuse's `d` (gated), distinct from the partial-behavior `a` — so the three states are genuinely distinct, validating a 3-state (not 2-state) table.

## Decisions shaped

- **#1837** — keep the monolith + subpath exports (don't reverse #1045); the per-plug-package ask (W6/#1846) is reframed: subpath exports already deliver its minimal-install goal.
- **#1838** — default served `form` = unplugged (forced by #606/#1826); plugged is `?form=plugged` opt-in; plugged-only residue served plugged + `X-MaaS-Lossy`.
- **#1839** — strict residue bar (plugged-only ⟺ requires patching a global/prototype the plug doesn't own a handle to, unreproducible via WeakMap-keyed out-of-band attachment); 3-state parity table with a mandatory caveat note; marking lives as a per-API-member `parity` block on the plug contract data.

## Sources

Radix [radix-ui npm](https://www.npmjs.com/package/radix-ui) · Chakra [v3 migration](https://www.chakra-ui.com/docs/get-started/migration) · React Aria [discussion #6734](https://github.com/adobe/react-spectrum/discussions/6734) · MUI [bundle size](https://mui.com/material-ui/guides/minimizing-bundle-size/) · Lit [@lit/reactive-element](https://www.npmjs.com/package/@lit/reactive-element) · BCD [schema](https://github.com/mdn/browser-compat-data/blob/main/schemas/compat-data-schema.md) · caniuse [tokens](https://github.com/Fyrd/caniuse/blob/main/CONTRIBUTING.md) · Baseline [web-features](https://github.com/web-platform-dx/web-features/blob/main/docs/baseline.md)
