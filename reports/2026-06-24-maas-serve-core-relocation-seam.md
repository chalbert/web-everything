# MaaS serve-core relocation seam — grounding report (#1771)

**Prepared 2026-06-24.** Blocks #1730 (relocate the MaaS serving runtime out of WE per #1282).
Prior-art is prior rulings, not a web survey — see *Why no /research/ topic* below.

## The question

#1730 reads as "relocate `we:blocks/renderers/module-service/` runtime → FUI, keep the build-time
`serve()` projection + vectors + IR." Claiming it surfaced that the seam is not a clean per-file move:
the WE-resident build-time projector imports `serve()`, and `serve()` rides the shared
component/jsx/functional transform core. #1771 decides the seam.

## Why no /research/ topic

Same posture as #956 (the prior module-service placement call): the prior art is **prior rulings**
(#1282 zero-impl · #1566 carve-out bound · #1467 verifier-vs-subject · #954 author-mode data-emit ·
#956 reference-runtime keeper · #461/#506 the Fetch origin + golden corpus · #1760 the FUI rebuild),
not browser standards. Nothing greenfield is designed, so there is no web survey to publish — the work
was grounding the real import graph against the placement statute.

## Grounding (verified against the tree, 2026-06-24)

**The forced part — the *delivery* runtime leaves WE.** `we:docs/agent/platform-decisions.md:75-97`
(rule 1, #1282, resolved 2026-06-20): "WE never hosts delivery runtime, not even as a 'reference
implementation'. The former reference-implementation tier … is **withdrawn**." It names WE-resident
reference runtimes as "tracked relocation debt [that] currently **violate** [the rule]." The live
`/_maas/` serve origin (`we:tools/maas/vite-plugin.ts:138`, `we:blocks/renderers/module-service/fetchHandler.ts`,
`we:blocks/renderers/module-service/productionDelivery.ts` + `prewarm`/`reactivity`/`incrementalUpdate`)
is exactly that — a delivery runtime. It is forced out.

**The staying part — the build-time generator is the #1566 carve-out.** The same rule keeps "conformance
*tooling* a WE-side `we:capability-manifest/check.ts` gate consumes … #1566 bounds this: the carve-out
covers tooling that checks WE's *own declarative artifacts* — manifests, **golden-corpus
completeness/schema-validity**" (`we:docs/agent/platform-decisions.md:84-89`). The author-mode emit is
precisely that: `we:scripts/gen-author-mode-source.mjs` bundles
`we:blocks/renderers/module-service/authorModeSource.ts`, runs `serve()` over the `componentCases`
fixtures, and writes `we:src/_data/authorModeSource.json`;
`we:blocks/__tests__/unit/renderers/authorModeSource.test.ts:33-34` re-runs `buildAuthorModeSource()` and
byte-compares (generate-and-freeze over WE's **own** corpus). That is bucket-2 authoring/validation
tooling, not a delivered capability. So `serve()` + `FORMS` + the component/jsx/functional transform core
it dispatches to **stay WE** as a build-time generator.

**The gate guard stays valid, not superseded.** `we:scripts/check-standards-rules.mjs:1249`
(`REFERENCE_RUNTIME_FORMS = {declarative, wc-class, html, jsx, functional}`, #956) freezes the *build-time
form catalog* and forbids adding framework targets (those → FUI genWrapper, #855). It governs the staying
kernel, not the withdrawn delivery tier — #1282 did not withdraw it.

**#1029 does not supersede the serve path.** `fui:tools/maas/wrapperServeHandler.mjs:5-10` serves
**framework wrapper bytes** (React/Vue), a distinct artifact from WE MaaS's authored-`<component>`
lowering. So "delete the WE runtime as redundant-to-#1029" is wrong on the merits.

**But #1760 *does* make the delivery siblings deletable.** `backlog/1760` plans a **fresh** FUI
authored-component serve route — "a sibling route to `fui:tools/maas/wrapperServeHandler.mjs`, keyed off
caseId against `we:src/_data/authorModeSource.json` … with produceFunctionalBytes-live injected as the
producer" — explicitly **off committed WE data**, not importing WE's
`we:blocks/renderers/module-service/fetchHandler.ts`. The committed-data seam is already live:
`fui:tools/maas/functionalAuthoringForm.mjs:42` reads `we:src/_data/authorModeSource.json` ("Never imports
WE's `serve()` — the #700 boundary"). The only live WE consumer of `/_maas/` is the legacy WE-website demo
(`we:demos/maas-consumer-demo.ts`) — the website-conflation rule 1 withdraws.

## The call (prepared defaults)

- **Fork 1 — cut location:** the `serve()` form-projection kernel + transform core **stays WE** as a
  build-time author/validate generator (carve-out). The whole-core→FUI alternative is coherent (via the
  #1595 CLI boundary) but strictly costlier — it replaces a working in-WE generate-and-freeze + drift
  test with a cross-repo build dependency for zero benefit.
- **Fork 2 — delivery siblings:** **delete** them and let #1760 rebuild fresh off committed WE data;
  relocating would duplicate the origin #1760 explicitly rebuilds.
  `we:blocks/renderers/module-service/conformance/golden.json` stays as committed WE conformance data; its
  regeneration relocates with the subject (`we:blocks/renderers/module-service/conformance/referenceTarget.ts`
  → FUI/#1760). `we:blocks/renderers/module-service/servePathIR.ts` /
  `we:blocks/renderers/module-service/servePathOpenAPI.ts` / IR + vectors stay WE as contract.

Skeptic run folded into both forks (see item). Net: this confirms the card's **Branch A** spine and
**Branch C** for the delivery siblings — *not* Branch B (whole transform core → FUI).
