---
kind: decision
status: active
relatedProject: webcomponents
relatedReport: reports/2026-06-24-maas-serve-core-relocation-seam.md
preparedDate: "2026-06-24"
blocks: ["1730"]
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
tags: [maas, placement, zero-implementation, renderers, devtools-placement]
---

# Resolve the MaaS serve-core relocation seam — the build-time author-mode projector imports the serve() the card relocates

#1730's "relocate `we:blocks/renderers/module-service/` runtime → FUI, keep the build-time `serve()`
projection" is not a clean per-file move: the WE-resident build-time projector imports `serve()`, and
`serve()` rides the shared component/jsx/functional transform core. This decides the seam so #1730 can
execute. **Prepared 2026-06-24** ([report](../reports/2026-06-24-maas-serve-core-relocation-seam.md)).

## Grounding digest — the finding that reshapes the call

Grounding the import graph against the placement statute splits the dir cleanly along **#1282's own
delivery-vs-tooling line**, so the call is *not* the card's original A/B/C:

- **The *delivery* runtime is forced out — not an open fork.** `we:docs/agent/platform-decisions.md:75-97`
  (rule 1, #1282, resolved 2026-06-20) withdrew the reference-implementation tier wholesale — "WE never
  hosts delivery runtime, not even as a 'reference implementation'" — and names WE-resident reference
  runtimes as "tracked relocation debt [that] **violate**" the rule. The live `/_maas/` origin
  (`we:tools/maas/vite-plugin.ts:138` + `we:blocks/renderers/module-service/fetchHandler.ts` +
  `productionDelivery`/`prewarm`/`reactivity`/`incrementalUpdate`) is that delivery runtime. It leaves WE.
- **The build-time `serve()` *kernel* legitimately stays — it is the #1566 carve-out.** Rule 1 keeps
  "conformance *tooling* a WE-side `we:capability-manifest/check.ts` gate consumes … checks WE's *own
  declarative artifacts* — golden-corpus completeness/schema-validity" (`we:docs/agent/platform-decisions.md:84-89`).
  The author-mode emit is exactly that: `we:scripts/gen-author-mode-source.mjs` runs `serve()` over the
  `componentCases` fixtures → `we:src/_data/authorModeSource.json`, and
  `we:blocks/__tests__/unit/renderers/authorModeSource.test.ts:33-34` drift-tests it by re-generating and
  byte-comparing. Generate-and-freeze over WE's **own** corpus = bucket-2 authoring tooling, not a
  delivered capability. So `serve()` + `FORMS` (`we:blocks/renderers/module-service/moduleService.ts:33,142`)
  + the `component`/`jsx`/`functional` transform core it dispatches to (`:17-19`) **stay WE**.
- **The gate guard stays valid.** `we:scripts/check-standards-rules.mjs:1249`
  (`REFERENCE_RUNTIME_FORMS = {declarative, wc-class, html, jsx, functional}`, #956) freezes the build-time
  form catalog and routes new framework targets to FUI genWrapper (#855). It guards the *staying* kernel —
  #1282 withdrew the delivery tier, not this. So the original card-bullet "the gate reads the file" resolves
  trivially: the file (the kernel) stays, the gate path is unaffected.
- **#1029 does not supersede the serve path — but #1760 makes the delivery siblings *deletable*.**
  `fui:tools/maas/wrapperServeHandler.mjs:5-10` serves framework *wrapper* bytes (a distinct artifact from
  authored-`<component>` lowering), so "delete as redundant-to-#1029" is wrong. But `backlog/1760` plans a
  **fresh** FUI authored-component route "off `we:src/_data/authorModeSource.json` … not importing WE's
  fetchHandler", and `fui:tools/maas/functionalAuthoringForm.mjs:42` already reads that committed JSON as
  data. The only live WE `/_maas/` consumer is the legacy website demo `we:demos/maas-consumer-demo.ts`.

## Recommended path at a glance

| Fork | Question | Options | Recommended default |
| --- | --- | --- | --- |
| 1 | Where does the `serve()` form-projection kernel + transform core live? | (a) stays WE as build-time generator · (b) graduates to FUI, WE emits via CLI | **(a) stays WE (carve-out)** |
| 2 | The runtime *delivery* siblings (forced out of WE) — relocate or delete? | (a) delete; #1760 rebuilds fresh · (b) relocate to FUI | **(a) delete** |

### Supported by default (not forks)

- **The delivery runtime leaving WE** is a forced invariant (#1282), not a fork — the only open question
  is its *disposition* (Fork 2).
- **The IR + contract + conformance vectors stay WE** as contract/data —
  `we:blocks/renderers/module-service/servePathIR.ts` (pure types, zero imports) +
  `we:blocks/renderers/module-service/servePathOpenAPI.ts` + the IR.
  `we:blocks/renderers/module-service/conformance/golden.json` stays as committed WE conformance data; only
  its *regeneration* (which needs the moving HTTP handler) relocates.

## Fork 1 — where does the `serve()` form-projection kernel + transform core live?

*Fork-existence:* the code lives in exactly one repo, so the two homes genuinely cannot coexist. Both are
coherent — (b) is buildable across the #1595 CLI/runtime boundary — so this is a real either/or, not a
forced invariant; the call is which home is correct.

- **(a) Stays WE as a build-time author/validate generator (carve-out).** ✅ default. `serve()` + `FORMS` +
  the `component`/`jsx`/`functional` transform core are invoked *only* by build-time generators over WE's
  own fixtures — the author-mode emit (`we:blocks/renderers/module-service/authorModeSource.ts:19`) and the
  golden-vector generator — both drift-tested in WE against WE's own committed artifacts. That is the exact
  #1566 carve-out (`we:docs/agent/platform-decisions.md:84-89`). FUI consumes the *output as data*
  (`fui:tools/maas/functionalAuthoringForm.mjs:42`), never the code — the #700/#954 seam holds. #956 +
  `REFERENCE_RUNTIME_FORMS` stay as the guard against the catalog growing a framework target.
- **(b) Graduate the whole transform core to FUI; WE's build shells out to a FUI CLI** to emit
  `we:src/_data/authorModeSource.json` (the #1595 boundary makes the CLI call legal, not a WE→FUI code
  edge). Coherent and aligns *all* renderer impl to FUI uniformly — but it replaces a working in-WE
  generate-and-freeze + drift test with a cross-repo build dependency for **zero** benefit, and breaks the
  in-WE drift seam that today self-regenerates with no cross-repo call.

**Skeptic:** SURVIVES-WITH-AMENDMENT. Prep's first pass defaulted (b) on a strict "all renderer impl → FUI"
reading; the skeptic showed `we:blocks/__tests__/unit/renderers/authorModeSource.test.ts:33-34` drift-tests
the emit *in WE* over WE's own corpus — the #1566 carve-out, not a delivered runtime — so (a) is correct and
(b) gratuitously breaks a working data seam. Default flipped to (a).

## Fork 2 — the runtime delivery siblings: relocate to FUI, or delete?

*Fork-existence:* the siblings leave WE regardless (Fork 1 grounding — #1282 forces the delivery runtime
out); both dispositions are coherent and cannot coexist (the files are relocated **or** deleted), so the
genuine call is which. The siblings: `we:blocks/renderers/module-service/fetchHandler.ts`,
`we:blocks/renderers/module-service/productionDelivery.ts`,
`we:blocks/renderers/module-service/prewarm.ts`, `we:blocks/renderers/module-service/reactivity.ts`,
`we:blocks/renderers/module-service/incrementalUpdate.ts`,
`we:blocks/renderers/module-service/definitionRegistry.ts` (the runtime resolver registry), the
`we:tools/maas/vite-plugin.ts` `/_maas/` origin, and the conformance
`we:blocks/renderers/module-service/conformance/referenceTarget.ts` (the HTTP reference *subject* —
→ FUI/Plateau per #1467/#1566).

- **(a) Delete; let #1760 rebuild fresh off committed WE data.** ✅ default. `backlog/1760` already plans a
  fresh FUI authored-component serve route mirroring #1029, keyed off `we:src/_data/authorModeSource.json`
  with its own `produceFunctionalBytes` producer, **explicitly not importing WE's fetchHandler**.
  Relocating WE's siblings would land a *second, redundant* origin #1760 doesn't consume. The only live WE
  consumer is the legacy website demo `we:demos/maas-consumer-demo.ts` — the website-conflation rule 1
  withdraws. `we:blocks/renderers/module-service/conformance/golden.json` freezes as committed WE
  conformance data; its regeneration relocates with the subject (the new FUI origin becomes the reference
  target).
- **(b) Relocate the siblings to FUI.** Preserves #461's framework-agnostic, conformance-tested Fetch
  handler rather than discarding it. But #1760's *fresh-build* plan moots the reuse — relocating duplicates
  what #1760 rebuilds, so the preserved code becomes dead-on-arrival in FUI.

**Skeptic:** REFUTED the original relocate default. Prep first defaulted (b)/relocate ("preserve the
vector-backed #461 handler"); the skeptic traced `backlog/1760` to find FUI rebuilds the authored origin
*fresh* off committed data and does **not** import WE's handler, so relocating duplicates a discarded
origin. No non-legacy WE consumer exists. Default flipped to (a)/delete.

## What you decide

Ratify the seam: **Fork 1 (a)** the `serve()` kernel + transform core stays WE as a build-time generator
carve-out; **Fork 2 (a)** delete the delivery siblings and let #1760 rebuild the FUI authored-component
origin fresh off committed WE data. On ratification #1730 unblocks and executes the per-file split:
keep the kernel + author-mode emit + IR + vectors + the frozen
`we:blocks/renderers/module-service/conformance/golden.json` data in WE; delete the delivery runtime + the
`/_maas/` origin + the HTTP reference subject. **Un-park trigger:** none — ready to ratify now; #1730 is the
only dependent and is `blockedBy` this.

## Lineage

Surfaced claiming #1730 in `batch-2026-06-24-1768-1730` (a buried fork the pre-flight skim missed; caught
at claim-time grounding). #1730 `blockedBy` this. Reverses #954's "WE runs `serve()`"? No — it *confirms*
it (the kernel stays WE), and sharpens #956: the build-time form-generation kernel stays (carve-out), the
demo/delivery-origin half #956 also kept is withdrawn by #1282. Grounds: #1282 (zero-impl) · #1566
(carve-out bound) · #1467 (verifier-vs-subject) · #1595 (runtime boundary ≠ code edge) · #1760 (the FUI
rebuild) · `we:docs/agent/platform-decisions.md` constellation-placement + devtools-placement. Same shape
as #1577→#1747 (a relocate card that was actually a coupled design fork).
