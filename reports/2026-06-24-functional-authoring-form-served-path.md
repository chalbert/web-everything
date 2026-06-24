# Functional authoring-form served path — validation gate (#1746 prep)

**Date:** 2026-06-24 · **Decision:** [#1746](/backlog/1746-decide-the-functional-authoring-form-served-path-post-1619-o/)

## Question

Where (if anywhere) does the FUI functional-component adapter's *importable/runnable* output get served?
`fui:tools/maas/functionalAuthoringForm.mjs` has `produceFunctionalBytes(caseId)` (transpiles functional
JSX → importable ESM) but it has **zero consumers**.

## Why this is a validation-gate, not a 3-way merit fork

`produceFunctionalBytes` / `transpileFunctionalSource` are called only by
`fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs` (verified grep). The polyglot author-mode
panel `fui:workbench/authorMode.ts:50` renders the functional **source** from the data-emit and is
explicitly "pure of any live block state — the source is pre-emitted." So there is no live importer of the
runnable form. The candidate homes — (b) own MaaS serve endpoint, (c) live-mount/preview slice — are
**sequential layers, not a forced either/or**: (c) live-mount sits on top of a served byte source like
(b), exactly as the wrapper path's `react-live` form is served through the same
`fui:tools/maas/wrapperServeHandler.mjs` as a richer producer variant. No excluded branch ⇒ go/no-go gate.

## Prior-art delta (internal precedent)

| Precedent | Shape | Delta vs functional |
|---|---|---|
| Wrapper serve path (`fui:tools/maas/wrapperServeHandler.mjs`, #1029) | Fetch handler: content-identity + cache + CORS + error contract; producer injected via `options.produce` | Hard-wired to the wrapper catalog (`resolveWrapperForm` / `WRAPPER_FORMS`) + CEM tagName; functional keys off `caseId` against `authorModeSource.cases[]` and is **not** a wrapper member (#1619) — so a functional endpoint is a **sibling slice**, not a one-line `produce` swap |
| Wrapper live-mount (#1518) | react-dom + ErrorBoundary + mount/unmount over the existing served endpoint | The functional analog of (c); depends on the deferred #1030 same-document mount work |
| `#313`'s original premise | "add the FUI adapter as a FORMS entry, **replacing** the WE stub" | Dead, not merely deferred: #954 made WE the emitter + FUI the consumer (two ends of one pipe, not substitutes); #1619 separated the functional id; #1681 dropped the alias. #313 never promised a served runnable endpoint |

Note (skeptic correction): the wrapper served endpoint (#1029) shipped **alongside** its producer (#1085),
not "later on demand." So the wrapper precedent argues that *when a consumer exists*, the served endpoint
(b) is the natural shape to build immediately — the gate is consumer-absence, not a transform-first sequence.

## Recommendation

**Verdict: NOT-YET.** Close #313 as superseded — delivered by #1602 (the landed adapter) + the existing
author-mode panel. `produceFunctionalBytes` is latent infrastructure. **Un-gate trigger:** a concrete live
importer appears — a polyglot live-preview surface that wants to *run* (not just display) the functional
form. At that point build (b) the own serve endpoint (sibling to `fui:tools/maas/wrapperServeHandler.mjs`)
immediately, and (c) live-mount once #1030 lands.

## Skeptic

**SURVIVES-WITH-AMENDMENT.** Attacks on "hidden consumer" (none found), "validation-gate framing wrong"
((b)/(c) are sequential not either/or), and "#313 intent abandoned" (premise is dead) all failed. One
amendment landed: the original "mirror the wrapper transform-then-serve-later sequence" rationale was
factually wrong (the wrapper served bytes from day one). Replaced with the sound rationale — **no live
importer exists yet** — which independently supports NOT-YET. Verdict holds.
