---
kind: decision
status: open
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
preparedDate: "2026-06-24"
relatedProject: webcomponents
relatedReport: reports/2026-06-24-functional-authoring-form-served-path.md
tags: [maas, functional-adapter, serve-path, polyglot]
---

# Decide the functional authoring form served path post-#1619 — own MaaS endpoint / live-mount vs author-mode-source-only

## Digest

A go/no-go gate, not a fork: does the FUI functional adapter's *importable/runnable* output get a served
home **now**? Recommended verdict: **NOT-YET** (~70%). `fui:tools/maas/functionalAuthoringForm.mjs`'s
`produceFunctionalBytes(caseId)` has **zero consumers** (only a test); the polyglot panel already shows the
functional *source* from WE's data-emit. #313's "replace the WE stub" premise is dead (post-#954/#1619/#1681),
and the importable transpile is latent infrastructure with no live importer. Un-gate when a concrete
consumer — a polyglot live-*preview* that wants to **run** the form — appears; then build the own serve
endpoint (mirroring the wrapper handler) immediately, and live-mount once #1030 lands.

## What you're deciding

Whether to commit **now** to building a served home for the functional adapter's importable output, or
close #313 as delivered and leave `produceFunctionalBytes` as latent infrastructure until a consumer wants
it. The candidate (if built) takes one of two shapes — (b) an own MaaS serve endpoint, or (c) a
live-mount/preview slice — but those are *sequential layers*, not a choice to make today.

## Why this isn't a classic fork (and is still a decision)

There is no excluded rival branch: (a) "don't build a served home now" vs building one is a one-sided
**go/no-go on a candidate**, and the two candidate shapes (b) and (c) genuinely **coexist** — (c)
live-mount sits on top of a served byte source like (b), exactly as the wrapper path's `react-live` form is
served through the same `fui:tools/maas/wrapperServeHandler.mjs` as a richer producer variant. So this is
the validation-gate archetype (verdict + trigger), not a `## Fork N`. It is still a real decision: the
human decides whether building serve infrastructure with no consumer earns roadmap space now.

## Context & prior-art delta

| Precedent / fact | Shape | Delta vs functional |
|---|---|---|
| `produceFunctionalBytes` (`fui:tools/maas/functionalAuthoringForm.mjs:105`) | transpiles functional JSX → importable ESM | **Zero consumers** — called only by `fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs` |
| Polyglot author-mode panel (`fui:workbench/authorMode.ts:50`) | renders functional **source** from the data-emit; "pure of any live block state" | Needs nothing here — it shows source, not runnable bytes |
| Wrapper serve path (`fui:tools/maas/wrapperServeHandler.mjs`, #1029) | Fetch handler: content-identity + cache + CORS + error contract; producer injected via `options.produce` | Hard-wired to the wrapper catalog (`resolveWrapperForm` / `WRAPPER_FORMS`) + CEM tagName; functional keys off `caseId` against `authorModeSource.cases[]` and is **not** a wrapper member (#1619) — a functional endpoint is a **sibling slice**, not a one-line `produce` swap |
| Wrapper live-mount (#1518) | react-dom + ErrorBoundary + mount/unmount over the existing endpoint | The functional analog of (c); depends on the deferred #1030 same-document mount |
| #313's premise | "add the FUI adapter as a FORMS entry, **replacing** the WE stub" | Dead: #954 made WE emitter + FUI consumer (two ends of one pipe, not substitutes); #1619 separated the functional id; #1681 dropped the alias |

WE owns the emitter (`we:blocks/renderers/functional/functionalComponent.ts` `generateFunctionalSource`,
dispatched by `we:blocks/renderers/module-service/moduleService.ts`) → `we:src/_data/authorModeSource.json`;
FUI consumes it. The codified `#authoring-form-id-distinct-from-consume-wrapper` rule
(`we:docs/agent/platform-decisions.md`) confirms functional is its own authoring-form id-space, not a
wrapper `?form=` member — so a served functional path is a sibling to, not a member of, the wrapper handler.

## Dependencies & lineage

#313 is `blockedBy` this — it cannot proceed as written until the served-path question is settled
(resolving this go/no-go either closes #313 or spawns the build slice). Live-mount (c) further depends on
#1030 (same-document mount, open/blocked-in-fact). Surfaced during batch-2026-06-23-1725-1665 working #313
(un-parked when its blocker #1602 resolved). Grounds: #954 (data-emit), #1619 (functional id separation),
#1681 (alias drop), #1602 (the landed adapter). Report:
`we:reports/2026-06-24-functional-authoring-form-served-path.md`.

## Recommendation

**Verdict: NOT-YET (~70%).** Resolve #313 as superseded — delivered by #1602 + the existing author-mode
panel. Keep `produceFunctionalBytes` as latent infrastructure. **Un-gate trigger (concrete):** a live
importer materialises — a polyglot live-*preview* surface that imports + runs a case's functional ESM
(not merely displays its source). When that consumer is specced, build (b) the own serve endpoint as a
sibling to `fui:tools/maas/wrapperServeHandler.mjs` (its own content-identity + cache + error contract)
immediately — the wrapper precedent served bytes from day one — and add (c) live-mount once #1030 lands.

**Skeptic:** SURVIVES-WITH-AMENDMENT. Attacks on a hidden consumer (none found via grep), on the
validation-gate framing ((b)/(c) are sequential layers, not an either/or), and on "#313 intent abandoned"
(its premise is dead, not deferred) all failed. One amendment folded in: the original "mirror the wrapper
transform-then-serve-*later* sequence" rationale was factually wrong — the wrapper served endpoint (#1029)
shipped *alongside* its producer (#1085), not later. Replaced with the sound rationale that survives:
**no live importer of the runnable form exists yet**, which is the true basis for NOT-YET.
