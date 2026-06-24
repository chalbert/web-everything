---
kind: decision
status: active
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
home **now**? Recommended verdict: **NOT-YET** (~65%). `fui:tools/maas/functionalAuthoringForm.mjs`'s
`produceFunctionalBytes(caseId)` has **zero consumers** (only a test); the polyglot panel already shows the
functional *source* from WE's data-emit. #313's "replace the WE stub" premise is dead (post-#954/#1619/#1681),
and the importable transpile is latent infrastructure with no live importer. **The workbench shipping in
both the WE and FUI docs sites is *not* this consumer** — it renders functional *source* (already wired:
#1618 transport, #1748 WE-site mount), never the runnable bytes. The true consumer is a distinct, unfiled
**functional live-preview** — the functional sibling of the wrapper live-mount chain (#1518 producer /
#1030 workbench mount), gated on the same render-target decision **#1594**. Un-gate when that functional
live-run is wanted as a product; then build (b) the serve endpoint as the functional sibling of #1518 and
(c) the mount as the functional analog of #1030.

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

## Discussion 2026-06-24 — "isn't the workbench-in-both-sites the consumer?"

Challenge raised: this looks like a broken blocker chain — we'll certainly want the polyglot workbench in
both the WE and FUI docs sites; aren't those the consumers we're waiting for? Grounding the live FUI tree
resolved a **conflation** between two distinct "functional" artifacts:

- **Functional *source*** — the React-function rendition the declarative `<component>` lowers to, shown as a
  read-only tab. `fui:workbench/authorMode.ts` renders this from WE's `we:src/_data/authorModeSource.json`
  emit, "pure of any live block state." Embedding the workbench in both sites consumes **this** — and it is
  *already wired* (#1618 transport residual; #1748, active, the WE-site element-load mechanism). It does
  **not** import or run `produceFunctionalBytes`.
- **Functional *runnable bytes*** — `produceFunctionalBytes`, the importable ESM that can actually **run**.
  This is #1746's orphan. Its only consumer would be a surface that *imports + mounts* the functional form.

So **workbench-in-both-sites is not #1746's consumer** — it's the consumer of the *source emit*, which is
solved elsewhere. The genuine consumer is a **functional live-preview**, and grounding shows it is the exact
sibling of the wrapper live-mount chain, which is nearly complete: #1029 serve → #1501 cross-origin → #1518
react-dom+ErrorBoundary producer → #1556 CORS → #1030 workbench mount (mechanism **proven end-to-end**,
blocked only on the **#1594** render-target decision: live-mount into the stage-as-subject vs a separate
preview). #1746's (b) endpoint is the functional analog of #1518's producer; (c) the functional analog of
#1030; both would gate on the same **#1594**.

**The real open question is therefore a product call, not "wait for a hypothetical consumer":** do we want
to *live-run* the author-mode **functional** form — distinct from (a) showing its source (done), the native
block already rendering live (mode C, `fui:workbench/mount.ts`), and (b) live-running the *wrapper* (#1030)?
Running the functional lowering additionally proves the React-native rendition is faithful — plausible but
the **weakest** of the live-mount cases (the native render + wrapper live-mount already cover "see it run").

## Recommendation

**Verdict: NOT-YET (~65%).** Resolve #313 as superseded — delivered by #1602 + the existing author-mode
panel. Keep `produceFunctionalBytes` as latent infrastructure. **Un-gate trigger (sharpened):** *not* the
workbench shipping in both sites (that's source-only), but a decision that the **functional live-preview**
is wanted as a product. When it is, build (b) the serve endpoint as the functional **sibling of #1518**
(its own content-identity + cache + error contract; not a wrapper-catalog member, #1619) and (c) the mount
as the functional **analog of #1030** — both `blockedBy: 1594` (the render-target decision the wrapper path
must settle first). I hold NOT-YET because the functional live-run is the weakest live-mount case and
shouldn't open a build slice ahead of #1594 resolving for the wrapper path anyway — but **GO is fully
defensible** if the functional live-preview is judged wanted now, in which case this resolves by filing that
build story (sibling of #1518 + analog of #1030, `blockedBy: 1594`) and rewiring the chain to it.

**Skeptic:** SURVIVES-WITH-AMENDMENT. Attacks on a hidden consumer (none found via grep), on the
validation-gate framing ((b)/(c) are sequential layers, not an either/or), and on "#313 intent abandoned"
(its premise is dead, not deferred) all failed. One amendment folded in: the original "mirror the wrapper
transform-then-serve-*later* sequence" rationale was factually wrong — the wrapper served endpoint (#1029)
shipped *alongside* its producer (#1085), not later. Replaced with the sound rationale that survives:
**no live importer of the runnable form exists yet**, which is the true basis for NOT-YET.
