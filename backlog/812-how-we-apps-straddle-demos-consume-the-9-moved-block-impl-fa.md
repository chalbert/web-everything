---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-812-runtime-block-composition-boundary.md
tags: [blocks, demos, boundary, constellation, decision-prep]
---

# How WE apps + straddle demos consume the 9 moved block-impl families post-deletion

**Prepared 2026-06-16 — ready to ratify.** Grounded in a prior-art survey published as
[`/research/we-fui-runtime-block-composition/`](/research/we-fui-runtime-block-composition/) (report
[`2026-06-16-812-runtime-block-composition-boundary.md`](../reports/2026-06-16-812-runtime-block-composition-boundary.md)).
The survey **dissolved one of the four options** (option c — see Fork 1) and the standing test
**re-scoped the affected set** (one demo was mis-listed — see *Pass-0 re-scope*), leaving **two genuine
forks**, each with a **bold** recommended default grounded in the real tree. Resolving this turns the
[#697](/backlog/697-delete-we-s-vendored-blocks-and-repoint-we-imports-build-to/) cutover agent-ready.

## The axis it decomposes into

Once #697 deletes WE's 9 vendored block-impl families (`audit`, `background-task-surface`, `data-grid`,
`lifecycle`, `master-detail`, `selection`, `stepper`, `tree-select`, `type-ahead`), the WE artifacts that
**compose** those families *as building blocks* have no sanctioned runtime. The three closed doors, pinned
to the tree:

- **Can't iframe** — a full exercise app / standard-runtime demo is not one embeddable block (the
  [#791](/backlog/791-reconcile-658-697-delete-and-repoint-with-the-604-iframe-bou/) iframe rule is for
  *block-impl demos* whose subject is the block itself).
- **Can't `import '@frontierui/blocks'`** — the [#707](/backlog/707-reconcile-604-s-we-renders-real-fui-blocks-framing-with-the-/)
  boundary, struck 4× (#700/#701/#705/#707); there is **no `frontierui` vite alias** (`vite.config.mts:167`
  aliases only `@core`/`@web*`), by design.
- **Can't get classes from #765** — [#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/)'s
  in-document mount is "runtime SDK only — mount a *rendered* FUI thing." It hands the host an opaque
  element, **never a block class** to wire (`docs/agent/demo-workflow.md:31` states the boundary; the only
  embed seam is the `fuiDemo` shortcode, `.eleventy.js:38`).

**The survey settles the one tempting escape (option c).** "Extend #765's SDK to expose composable block
*factories/classes*" looks like a principled third path. It is not: across Module Federation, ESM-CDN
import maps, web-components, the micro-frontend taxonomy, and every real cross-trust SDK (Stripe Elements),
the dividing line is **class vs. element/mount** — handing over a *class* the host instantiates/subclasses
runs it in the host's realm with the host's privileges and shared dep graph, which is **identical** to
`import '@frontierui/blocks'`. So option (c) is the #707-forbidden import with extra ceremony — **struck**,
not a coherent branch (the same verdict #791 reached for source imports). That removes (c) from both forks
below.

### Pass-0 re-scope — `durable-tier-verification` is not a straddle

It imports **only** `background-task-surface` (a moved family) —
`demos/durable-tier-verification/durable-tier-verification.ts:28,32` — with **no** retained family. So it
is a plain **block-impl demo** (its subject *is* the block), already dispositioned by #791 (→ FUI,
iframe-embed) + the B1 FUI-hosting prerequisite. Its only wrinkle is a service-worker + Background-Fetch
dependency (`durable-sw.js`); a FUI-hosted page registers the SW on FUI's own origin, so the iframe embed
is feasible — a **footnote on #791/B1, not a B3 fork**. It is dropped from this decision's scope. The
genuine B3 surface is the **two exercise apps** (Fork 1) + the **one true straddle demo**
`loader-background-handoff` (Fork 2).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|--------------------|------------------|-----------|
| **1 — the two exercise apps** (`loan-origination`, `auto-insurance`) | **(a) Move to FUI** — apps compose block *classes*; classes live only in FUI post-#697; WE can't import them | (d) Decouple to reference-runtime-only (guts the apps) | **high** — near-forced once (b)/(c) are struck |
| **2 — the true straddle demo** (`loader-background-handoff`) | **(d) Decouple** — keep a WE demo of the loader *escalation contract*; FUI's surface demo covers the receiver | (a) Move whole demo to FUI (FUI has both families; loses WE's loader-escalation reference demo) | med-high |

## Fork 1 — the two exercise apps' consumption path

`loan-origination` and `auto-insurance` compose **4–5 moved families as classes** —
`demos/loan-origination/app.ts:22-31` (`MasterDetailBehavior`, `LifecycleProvider`, `AuditProvider`) +
`wizard/applicationWizard.ts:21` (`StepperBehavior`); `demos/auto-insurance/app.ts:14-21` adds
`TreeSelectBehavior` — **plus** WE-only reference-runtime renderers FUI lacks
(`renderers/{data-table,pagination,status-indicator,audit-timeline,decision-trace}`; FUI's `renderers/`
holds only `data-grid`). They need block **classes** to wire behaviors with domain logic — exactly what the
survey shows no boundary-preserving runtime path can supply.

- **(a) Move the exercise apps to FUI.** *(recommended)* The only path that lets the apps keep composing
  the real block classes (which only FUI holds post-#697; FUI already vendors them byte-identical). Moving
  the apps up also brings the reference-runtime *renderer impls* they compose into FUI — coherent, because
  renderers are impl; WE keeps its own reference-runtime renderer **demos** for the data-table / pagination
  standards. The apps' WE conformance-forcing-function role is **preserved, not dissolved**: they become
  FUI-hosted apps WE iframe-embeds in the docs showcase (the #791/#701 pattern) and still file
  standard-gaps upstream — an app composing FUI impl is, per the constellation, an impl-layer artifact
  (the app-scale analogue of #791's block-impl-demo → FUI).
- **(d) Decouple — rebuild on WE's retained reference-runtime families only.** Coherent but **guts the
  apps**: stripping `master-detail`/`lifecycle`/`audit`/`stepper`/`tree-select` leaves a thin renderers-only
  shell, or re-vendors equivalents into WE (re-opening the resolved
  [#641](/backlog/641-decide-the-block-protocol-implementation-boundary-we-blocks-/)
  blocks=application-impl classification). Inferior, not broken.
- **(b) Re-classify the consumed families as reference-runtime that stays in WE.** *Struck* — contradicts
  #791's ratified "9 move" and re-opens #641.
- **(c) Runtime factory federation.** *Struck* — the survey shows it equals the #707-forbidden import (see
  the axis paragraph).

**Default: (a) move the apps to FUI.** It is the only branch that satisfies the hard constraint (apps need
classes; classes live only in FUI; WE can't import them, and federation *is* importing). The
forcing-function objection that motivated (a)'s "rejected-leaning" framing in the #697 split analysis
does not survive grounding: the role is the *upstream gap-filing*, which iframe-embed + provenance
preserves. *Red-team note for the decision turn:* the alternative argues "moving the deliverable out of WE
dissolves the proof" — answer it by ratifying the embed-back + gap-file mechanism as the explicit
preservation of the conformance loop, and record the renderer-impl disposition (FUI gains the renderer
impls; WE keeps the renderer demos).

## Fork 2 — the true straddle demo (`loader-background-handoff`)

This demo composes `resource-loader` (a **STAY** reference-runtime family) + `background-task-surface`
(a **MOVE** family) **live in one context** to prove the escalation handoff —
`demos/loader-background-handoff-demo.ts:20-26` (`registerBackgroundTasks` from the moved surface +
`ResourceLoader`/`backgroundLoad` from the retained loader). Its producer half exercises a **WE-standard**
concern: the loader's `escalation:async` debounce threshold and the bubbling `background-task-register`
event contract (`src/_data/demos.json:82`).

- **(d) Decouple onto the escalation contract.** *(recommended)* Keep a WE demo that exercises the WE-standard
  half — a real `ResourceLoader` emitting the `background-task-register` handoff event when it crosses the
  `escalation:async` threshold — against a **minimal reference receiver**, not the moved impl. The receiving
  surface stays demoed on FUI's own `background-task-surface` demo (the #791 block-impl demo). The
  cross-boundary handoff is then proven by the **event contract**, which is precisely the standard seam —
  not by co-running a moved impl WE may no longer hold.
- **(a) Move the whole demo to FUI.** Coherent and mechanically frictionless — FUI already carries **both**
  `resource-loader` and `background-task-surface`. Cost: it removes WE's reference-runtime demo of the
  *loader escalation* (a WE standard), folding a WE-standard concern into FUI; the demo is then effectively
  a `background-task-surface` block-impl demo (its stated subject is "the producer half of the Background
  Task Surface handoff").
- **(b) / (c)** — *Struck* as in Fork 1.

**Default: (d) decouple.** It keeps the WE-standard half (loader escalation) demoed *in WE* without
importing a moved family, and lets the seam — the `background-task-register` event — carry the handoff,
which is the constellation-correct boundary (standard = the contract; impl = FUI). (a) is the reasonable
fallback if the decider judges the live-into-the-real-surface fidelity worth folding the producer demo
into FUI.

## Resolution — ratified 2026-06-16

Both forks ratified at the recommended defaults; all grounding claims re-verified against the tree
before ratifying (app imports compose block *classes*; `loader-background-handoff` co-runs a STAY +
MOVE family; `durable-tier-verification` imports only the moved family; no `frontierui` vite alias).

- **Fork 1 → (a) Move the two exercise apps to FUI.** `loan-origination` + `auto-insurance` compose
  moved block *classes* with domain logic; classes live only in FUI post-#697 and WE cannot import
  them (federation *is* the #707-forbidden import). The reference-runtime **renderer impls** they
  compose (`renderers/{data-table,pagination,status-indicator,audit-timeline,decision-trace}`) move
  up with the apps (renderers are impl → FUI); **WE keeps its own renderer *demos*** for the
  data-table/pagination/etc. standards. Conformance-forcing-function role is **preserved**: the apps
  become FUI-hosted apps WE iframe-embeds in the docs showcase (#791/#701 pattern) and still file
  standard-gaps upstream into WE. Red-team ("moving the deliverable dissolves the proof") answered:
  the proof is the upstream gap-filing, kept by embed-back + provenance.
- **Fork 2 → (d) Decouple `loader-background-handoff` onto the escalation contract.** Keep a WE demo
  exercising the WE-standard half — a real `ResourceLoader` emitting `background-task-register` when
  it crosses the `escalation:async` threshold — against a **minimal reference receiver**, not the
  moved `background-task-surface` impl. FUI's own `background-task-surface` demo covers the receiver.
  The cross-boundary handoff is proven by the **event seam** (the standard contract), not by
  co-running a moved impl. (a) recorded as the fidelity-over-purity fallback.
- **`durable-tier-verification`** confirmed a plain #791 block-impl demo (imports only the moved
  `background-task-surface`; no retained family) → FUI/iframe-embed, with the service-worker /
  Background-Fetch dependency registered on FUI's own origin. **Not** a B3 straddle; dropped from the
  straddle set — a footnote on #791/B1, not a separate fork.

### Done when

- [x] Fork 1 ratified (a) — exercise-app consumption path recorded, with the renderer-impl disposition.
- [x] Fork 2 ratified (d) — `loader-background-handoff` disposition recorded.
- [x] `durable-tier-verification` re-tagged as a #791 block-impl demo (→ FUI/iframe, SW-on-FUI-origin
      footnote), not a B3 straddle.
- [x] #697 `blockedBy` updated to drop this once resolved; affected demos/apps get their per-artifact
      disposition recorded (this Resolution block is the disposition record #697 consumes).
