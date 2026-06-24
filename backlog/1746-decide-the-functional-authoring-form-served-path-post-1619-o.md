---
kind: decision
status: open
dateOpened: "2026-06-24"
relatedProject: webcomponents
tags: [maas, functional-adapter, serve-path, polyglot]
---

# Decide the functional authoring form served path post-#1619 — own MaaS endpoint / live-mount vs author-mode-source-only

Decide what consumes the FUI functional-component adapter's importable output now that the adapter has landed but #313's original premise is stale. `fui:tools/maas/functionalAuthoringForm.mjs` (#1602) reads WE's emitted `we:src/_data/authorModeSource.json` and `transpileFunctionalSource()` lowers each case's functional JSX to importable ESM — but `produceFunctionalBytes(caseId)` has **no consumer**: it is wired into no serve path, no demo, no panel. The polyglot/author-mode panel (`fui:workbench/authorMode.ts`) already renders the functional **source** from the data-emit, so it needs nothing here. The fork: where (if anywhere) does the *importable/runnable* functional form get served?

## Why #313's premise went stale

#313 ("add the FUI adapter as a FORMS entry, **replacing** the WE-internal generator stub") was written pre-#954/#1619/#1681. Three ratifications moved the ground under it:

- **#954 (data-emit, Fork 1 = A):** WE runs its transform core `serve()` at build time and commits per-block × per-form output to `we:src/_data/authorModeSource.json`; FUI **consumes** that data. So WE's `generateFunctionalSource` (`we:blocks/renderers/functional/functionalComponent.ts`, used by `we:blocks/renderers/module-service/moduleService.ts`) is the **emitter** and the FUI adapter is the **consumer** — two ends of one pipe, **not substitutes**. The FUI adapter cannot "replace" the WE emitter; deleting the emitter would starve the `we:src/_data/authorModeSource.json` the panel reads.
- **#1619 Fork-1:** ratified the authoring `functional` id as **wholly separate** from the consume-mode wrapper catalog (`fui:tools/gen-wrapper/wrapperFormCatalog.mjs` `WRAPPER_FORMS`). So functional is **not** a wrapper-serve `?form=` member.
- **#1681:** dropped the `functional → react-wrapper` retired alias (zero real callers), confirming functional is not served via `fui:tools/maas/wrapperServeHandler.mjs`.

So "add as a FORMS entry / replace the WE stub" no longer has a coherent buildable meaning — and the only output the adapter newly provides (importable transpiled bytes) has no v1 consumer because **live-mount is explicitly deferred** (#1602 render-only invariant, mirroring the wrapper `#1085 transform → #1501 bundle` path).

## What you decide

Pick the home (if any) for the functional adapter's importable output:

- **(a) Author-mode-source-only — close #313 as delivered by #1602 + the existing panel (recommended, ~60%).** The polyglot panel already shows the functional source from the data-emit; the importable transpile is latent infrastructure for a later live-mount slice. There is no in-scope consumer to build now; #313's intent is already satisfied by what shipped. *Resolve #313 as superseded.*
- **(b) Own MaaS serve endpoint for the functional authoring form.** Wire `produceFunctionalBytes` behind a serve path (sibling to `fui:tools/maas/wrapperServeHandler.mjs`, NOT in the wrapper catalog per #1619) so a consumer can import a case's functional ESM. Needs a content-identity + cache + error contract like the wrapper origin — a real slice, not a wire.
- **(c) Live-mount / preview slice.** Build the deferred live-mount (bundle renderer + mount/unmount) so the panel can *run* the functional form, mirroring the wrapper `#1518` live path. Largest; depends on the #1030 same-document mount work.

**Recommended default: (a).** The adapter + data-emit + panel already deliver the user-visible functional authoring experience; (b)/(c) are new capability slices to prioritise on their own merit, not #313's residual. Confidence ~60% — (b)/(c) are legitimate if a concrete consumer (a polyglot live preview) is wanted; that's a product call.

## Lineage

Surfaced during batch-2026-06-23-1725-1665 working #313 (un-parked when its blocker #1602 resolved). #313 is `blockedBy` this — it cannot proceed as written until the served-path question is settled. Grounds: #954 (`we:docs/agent/platform-decisions.md` data-emit), #1619 (Fork-1 functional id separation), #1681 (alias drop), #1602 (the landed adapter).
