# Author-mode source: form-set + generation-home for the FUI workbench

> Grounding for decision [#1865](/backlog/1865-author-mode-source-form-set-generation-home-for-the-fui-work/)
> (child of [#1618](/backlog/1618-wire-the-we-author-mode-source-artifact-into-the-live-fui-wo/) / epic
> [#746](/backlog/746-block-explorer-interactive-fui-block-workbench/)). Prepared 2026-06-27. Pure
> in-constellation prior-art survey — no human judgment; the call is `/next decision`'s job.

## What the workbench needs

The FUI block-explorer's **author-mode panel** (`fui:workbench/authorMode.ts`) shows a block's source in
several *author-mode* forms (the source a human would write), distinct from the *consume-mode* wrapper
bytes a host imports. The panel is already built and waiting for data. Two build-blocking sub-calls remain
before [#1618](/backlog/1618-wire-the-we-author-mode-source-artifact-into-the-live-fui-wo/) can wire it.

## (a) Form-set — what FUI faithfully emits

`AuthorModeForm` (`fui:workbench/authorMode.ts:23`) names **five** forms — `declarative | wc-class | html |
jsx | functional` — and carries a `lossy: boolean` + `diagnostics: string[]` pair (`fui:workbench/authorMode.ts:32-34`)
that the panel renders as a `⚠ Lossy` flag (`fui:workbench/authorMode.ts:87-90`). This is the **"Flag, don't
fake"** doctrine baked into the panel (`fui:workbench/authorMode.ts:12-15`): a form that can't be produced
faithfully arrives flagged, never faked.

FUI lowers its case fixtures (`fui:blocks/renderers/component/__fixtures__/component-cases.ts`, the relocated
SoT) to **3 of the 5** forms today:

| Form | Status | Emitter |
|---|---|---|
| `declarative` | ✅ faithful | the `<component>` definition text itself (no transform) |
| `wc-class` | ✅ faithful | `generateClassSource(def)` — `fui:blocks/renderers/component/declarativeComponent.ts:152` |
| `functional` | ✅ faithful | `generateFunctionalSource(def)` — `fui:blocks/renderers/functional/functionalComponent.ts:44` |
| `html` | ❌ missing | no html-text emitter anywhere in FUI or WE |
| `jsx` | ❌ missing | no jsx-text (usage-snippet) emitter |

No emitter computes `lossy`/`diagnostics` yet — that computation belongs to whatever generates the
`AuthorModeSource` data. The WE emitter (`we:scripts/gen-author-mode-source.mjs`) and its committed artifact
(`we:src/_data/authorModeSource.json`) that were once the source were **deleted by #1730** (the #1282 zero-impl
rule), so generation is now wholly a FUI concern off FUI's own fixtures.

**Panel is form-count-agnostic.** The panel iterates `source.forms` and builds exactly one tab per entry
(`fui:workbench/authorMode.ts:98-110`) — no hard-coded tab list, no "expected" count, no gap-filling. A
3-form source renders 3 tabs; a 5-form source renders 5. So shipping 3 forms now and adding `html`/`jsx`
later is pure **sequencing**, not a forced either/or — nothing in the consuming tree blocks on all 5.

## (b) Generation-home — where author-mode source comes from

The thin-descriptor registry is `WORKBENCH_BLOCKS` (`fui:workbench/registry.ts:276`), a small hand-authored
TS literal. Each descriptor already has an `authorSource?: AuthorModeSource` **data slot**
(`fui:workbench/registry.ts:143-147`) — same shape as the existing `cem?` slot — currently unpopulated. The
registry comment names the open seam: *"wiring it into the live registry is the follow-up transport slice."*

The FUI MaaS second origin (`fui:vite.maas.config.mts`, `fui:tools/maas/vite-plugin.mjs`) exposes three
routes today, none of which serve author-mode *source*:

- `/_maas/<block>.js?form=…` — consume-mode **polyglot wrapper bytes** (`react-wrapper`/`vue-wrapper`/`react-live`/`vue-live`, `fui:tools/gen-wrapper/wrapperFormCatalog.mjs`);
- `/_maas/data/<tag>.json` — the block's **CEM declaration** data;
- `/_maas/fn/<case>.js` — a **functional live-mount** transpile route (404s today; it read the deleted WE artifact).

The `/_maas/` origin exists for **cross-origin framework-dependency bytes that need transpile/bundle**
(#1499/#955 — keep the dev server framework-free). Author-mode source for display is **static text**: it needs
no transpilation, no framework deps, no cross-origin. So the generation-home choice is:

- **(B) build-emit author-source as data the descriptor's `authorSource` slot carries** — a FUI build step
  generating from `fui:blocks/renderers/component/__fixtures__/component-cases.ts` via the existing emitters. Inert display data (like `cem?`), so it does
  **not** re-introduce the imperative `load`/`create` closures #1731 Fork 2 banished from `fui:workbench/registry.ts`.
- **(A) a live `/_maas/` author-source endpoint** — the workbench fetches source text at runtime. This buys
  HMR (edit a fixture → see new source without a rebuild) but routes static display text through machinery
  built for transpilable cross-origin modules, conflating "serve a mountable module" with "serve already-
  rendered source text for a tab."

## Ratified architecture this sits under (#1731 / #1752)

[#1731](/backlog/1731-workbench-resolves-block-shape-from-the-fui-maas-serve-url-no/) ratified the workbench as
*thin UI over rendering*: the loadable **shape** resolves from the serve URL, **not** hard-coded literals in
`fui:workbench/registry.ts` (Fork 2 → thin descriptors + a loader, built as [#1752](/backlog/1752-fui-workbench-thin-descriptor-registry-maas-loader-split-acq/)).
Crucially #1731 also settled, *not as a fork*, that **source forms (`authorSource`) cross as pre-emitted DATA
the panel reads directly — no live instance** (source-only blocks return `null` from the loader,
`fui:workbench/loader.ts:37-43`). The statute `#we-data-crosses-via-fui-served-route` governs the WE→FUI byte
crossing — but the cases now live *in* FUI, so author-mode source is generated from FUI's own fixtures, and the
"thin descriptor carries pre-emitted data" reading is the one that binds. That is why **(B) is the default**:
it matches the existing `authorSource?` slot and the #1731 settled note, and reserves the live-read as a
documented dev-ergonomics upgrade rather than a v1 requirement.

## Skeptic pass (folded into the decision)

- **Fork 1 — SURVIVES.** A 3-form v1 does not cripple the panel (it renders exactly what it's handed,
  `fui:workbench/authorMode.ts:98-110`); "build `html`/`jsx` now vs later" is genuine sequencing with no distinct v1 benefit,
  and the emitters simply don't exist yet.
- **Fork 2 — SURVIVES-WITH-AMENDMENT.** The "no hard-coded literals" #1731 concern does **not** apply:
  `authorSource` is inert data like `cem?` (`fui:workbench/registry.ts:143-147`), not a behavioural `load`/`create` closure.
  The HMR attack is real but narrow (source-only block, no live instance to keep in sync; 9 fixtures), so the
  amendment is to label the build-emitted slot the **v1 interim** and the dev-server live-read the documented
  **upgrade seam** — not to flip the default.
