# Plugs runtime audit — per-plug unplugged/plugged/test/drift matrix — 2026-06-14

Backlog: [#635](/backlog/635-audit-the-current-plugs-runtime-per-plug-unplugged-plugged-t/). A discovery audit of the
plugs runtime tree to de-risk the [#170](/backlog/170-plugs-duplicated-across-webeverything-frontierui/) reversal
(FUI becoming the canonical `@frontierui/plugs`, per the [#606](/backlog/606-where-does-the-plugs-platform-layer-runtime-live-web-everyth/)
ruling that plugs = implementation, owned by Frontier UI) and to scope the dual-mode test backfill.

## Method

Inventoried every plug domain in `plugs/` (WE) and compared against `../frontierui/plugs/` (FUI). Per domain:
does it have a non-invasive **unplugged** form + an active **plugged** form, **dual-mode test** coverage (a test
exercising *both* modes), and is it **drifted** between the two copies (the copy-paste hazard #170 flagged)?
Drift found via `diff -rq` between the trees plus targeted reads of the load-bearing files.

## Per-domain matrix

| Domain | Key plugs | Unplugged | Plugged | Dual-mode tests | Drift (WE vs FUI) |
|---|---|---|---|---|---|
| webbehaviors | CustomAttributeRegistry / CustomAttribute / UndeterminedAttribute | ✓ | ✓ | partial (has `unplugged.integration.test`) | **drifted** |
| webcomponents | CustomElement, Element.insertion patch, cloneHandlers | ✓ | ✓ | partial | **drifted** |
| webcontexts | CustomContextRegistry / CustomContext, Node.contexts patch | ✓ | ✓ | partial | identical |
| webdirectives | CustomTemplateDirective | ✓ | ✓ | no | identical |
| webexpressions | CustomTextNodeRegistry / CustomTextNode / UndeterminedTextNode | ✓ | ✓ | partial | drifted (cosmetic) |
| webinjectors | Injector, InjectorRoot, HTMLInjector, declarativeInjector | ✓ | ✓ | partial | **drifted** |
| webregistries | CustomElementRegistry | ✓ | ✓ | partial | **drifted** |
| webstates | CustomStoreRegistry / CustomStore | ✓ | ✓ | partial | identical |
| webguards | CustomGuardRegistry | ✓ | ✓ | partial | **WE-only** |
| webvalidation | CustomValidatorResolutionRegistry / CustomValidityMergeRegistry / AsyncValidatorField | ✓ | ✓ | partial | **WE-only** |

Every domain implements the Plug interface (so all are *capable* of both modes); the gap is end-to-end **dual-mode
test** coverage — only `webbehaviors` has an unplugged-integration test; the other nine test the Plug interface in
isolation.

## Load-bearing drifts — WE is ahead (the reversal can't blindly take FUI)

1. **webcomponents `cloneHandlers.ts`** — WE has the select/datalist clone fix (#454, `hasOwnProperty` check); FUI
   still has the broken `'options' in node` form. **WE canonical.**
2. **webinjectors `Injector.ts`** — WE has #400 consumption-edge tracking (the provider↔consumer graph) + a WE-only
   `declarativeInjector.ts`; FUI lacks both. **WE canonical.**
3. **webregistries `CustomElementRegistry.ts`** — WE has `ensureNativelyConstructible()` (scoped-registry autonomous
   constructor legality); FUI lacks it. **WE canonical.**
4. **webbehaviors** — WE has a `viewportPresence.ts` abstraction; FUI inlines IntersectionObserver — *but* FUI has 3
   newer test files (defineLazy, inert, visibility) not in WE.
5. **webexpressions** — only cosmetic type differences (`parserName: null` vs `undefined`); functionally equivalent.

**Implication for #170:** the reversal is **not** a clean "delete WE, point at FUI" — WE holds several canonical
fixes FUI is missing. The reversal must first reconcile drift (port WE-ahead fixes into FUI) and decide the home of
the WE-only domains (webguards, webvalidation), or it regresses real behavior.

## Open questions (the genuine unknowns blocking #170)

Tracked as [#649](/backlog/649-reconcile-plugs-we-fui-drift-dual-mode-test-backfill-ahead-o/) (the actionable residual):

1. **Canonical reconciliation** — WE is ahead on #454 / #400 / scoped-registry fixes. Port WE→FUI before the reversal,
   or the reversal regresses.
2. **Dual-mode test backfill scope** — backfill unplugged-integration tests for the 3 highest-impact domains
   (webcomponents, webregistries, webinjectors) — a #170 precondition, or post-reversal?
3. **#400 introspection in FUI** — port the consumption-edge graph, or leave FUI without it?
4. **Scoped-registry constructor fix** — does FUI already solve `ensureNativelyConstructible()`, or is its absence a
   regression?
5. **WE-only domains** — are `webguards` + `webvalidation` WE-only by design, or not-yet-ported? If in scope, the
   reversal leaves FUI incomplete.
6. **`viewportPresence.ts` vs inline IntersectionObserver** — converge the pattern before FUI canonicalization to
   avoid re-divergence.
