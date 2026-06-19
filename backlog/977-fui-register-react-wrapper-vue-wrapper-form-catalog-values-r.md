---
type: issue
workItem: task
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: frontierui/tools/gen-wrapper/wrapperFormCatalog.mjs
parent: "746"
locus: frontierui
relatedProject: webadapters
tags: [maas, polyglot, block-explorer, frontierui]
---

# FUI: register react-wrapper/vue-wrapper form-catalog values; retire React-only functional form

Per #974 (A1 ruling): the MaaS wrapper-serve need rides the existing catalog-gated `form` param — no new WE contract surface. Register `react-wrapper`/`vue-wrapper` as injected FUI catalog values on the servePathIR `form` seam (validated against the injected catalog, unknown→400), and retire the accidentally React-only `functional` form by folding it into `react-wrapper`. genWrapper(cem,target) is the transform-provider injected at the endpoint. locus:frontierui. Provisional — refine the value-set as #912 surfaces real cases; promote to a neutral `framework` param only if forward-adapter routing later demands it (deliberate servePathIR version bump).

## Progress — resolved (batch-2026-06-18)

Built the injected catalog as a FUI module — `fui:tools/gen-wrapper/wrapperFormCatalog.mjs`
(+ `.d.ts` + unit test). Per #974 invariant #5 / #855, this lives in **FUI, not WE**: the
genWrapper-backed forms can't be wired into WE's reference `we:moduleService.ts` (genWrapper is
FUI-owned, never `@webeverything`), and the FUI endpoint is its own runtime conforming to the
type-only IR. So WE's reference catalog is untouched (A1 yields no WE artifact, as ratified).

- `WRAPPER_FORMS` — `react-wrapper`→`genWrapper(cem,'react')`, `vue-wrapper`→`genWrapper(cem,'vue')`,
  derived from genWrapper's `TARGETS` (one opaque `<target>-wrapper` wire id per A1's red-team finding:
  FUI owns its `{target,form}` factoring, WE sees one catalog value).
- `RETIRED_FORM_ALIASES` — `functional`→`react-wrapper`: a `functional` request resolves to the
  genWrapper React wrapper (served, not 400) with `aliasedFrom` recorded for an endpoint deprecation note.
- `serveWrapperForm(formId, cem)` — the injected transform-provider: validates against the catalog
  (unknown → `UnknownWrapperFormError`, the IR's 400 seam, carrying the known set) and dispatches.

Decoupled from #912's sandbox UI so it lands + tests now; the #912 endpoint consumes it. 5/5 unit
tests + `check:standards` green in `../frontierui`.
