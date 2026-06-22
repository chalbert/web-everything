---
kind: decision
parent: "912"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#single-introspection-slot"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-workbench-live-render-target.md
researchTopic: workbench-live-render-target
tags: []
---

# Workbench live-mount render target — into the stage as subject vs separate Polyglot live-preview

**Prepared 2026-06-22.** No design is being invented — this rules the render *target* for an already-proven
mechanism (cross-origin React/Vue live-mount `?form=react-live`, #1501/#1518/#1556). The one fork below is
grounded in a prior-art survey of how component explorers structure render-surface-vs-introspection,
published as `/research/workbench-live-render-target/` (session report linked via `relatedReport`). It
carries a **bold** recommended default that has been attacked by a skeptic and survived with an amendment.

## Ruling (ratified 2026-06-22)

**Fork 1 → (a) render the live React/Vue subject into the stage.** The cross-origin live-mount
(`?form=react-live`) renders into the stage — the one canonical introspection slot the inspector /
event-log / anatomy panels already read — rather than a separate preview pane (b, rejected). Grounding
re-verified at ratification: the `live` wrapper mounts the **real custom element** and forwards
attrs+events (`fui:tools/gen-wrapper/genWrapper.mjs:18`), `mount(el)=createRoot(el)→{update,unmount}`
(`fui:tools/gen-wrapper/genWrapper.mjs:223-236`), `renderStage` replaces the stage child
(`fui:workbench/mount.ts:247-262`). Default (a) survived the skeptic and a ratification-time red-team
(b's only case — isolation — is discharged by amendment 3's `unmount()` ownership; "bias-to-separation"
does not apply to duplicating one canonical introspection target, the surveyed anti-pattern).

**#1030 now agent-ready** with the three Fork-1(a) amendments in scope: (1) subject-node resolution,
(2) prop-routed trait/DS control via `instance.update(props)`, (3) `unmount()` lifecycle teardown. The
two "supported by default" items (render-beside-source is additive/out-of-scope; `exportAsCode` emits
wrapper source) carry into #1030 as build details, not forks.

## What you have to decide

Ratify where #1030's `mount(el,…)` points: **render the live React/Vue subject into the stage** (Fork 1,
default **(a)**), accepting the three bounded panel amendments below — or stand up a separate live-preview
pane with its own introspection wiring (Fork 1 (b)).

## Recommended path at a glance

| Fork | The call | Options | **Default** |
|------|----------|---------|-------------|
| 1 | Render target for the live-mount | (a) into the stage · (b) separate preview pane | **(a) into the stage** |

## Fork 1 — render target for the cross-origin live-mount

**Fork-existence justification (case b — coherent branches that cannot coexist):** there is *one* canonical
introspection slot. The inspector / event-log / anatomy panels can read the stage **or** a separate pane as
"the subject," not both at once — so (a) and (b) are a genuine either/or, not a support-both. (B's
render-beside-source *display* is separable and additive — see "Supported by default" — but B *as the
introspection target* excludes A.)

**Crux (refs into the real tree).** The stage is a plain `<div>`; `renderStage()` does
`block.create()` → `applyTrait` → `cqWrap.replaceChildren(next)` (`fui:workbench/mount.ts:247-262`).
The panels gate on the block's CEM-derived declaration (`fui:workbench/mount.ts:292`,
`fui:workbench/mount.ts:535`, `fui:workbench/mount.ts:693`, `fui:workbench/mount.ts:701`) but *read* the
DOM generically — inspector via `getComputedStyle`/`querySelector` (`fui:workbench/mount.ts:900-939`),
event-log via native delegation on the stage (`fui:workbench/mount.ts:683-692`), anatomy via
`instance.hasAttribute` (`fui:workbench/mount.ts:711-715`). The `live` wrapper **mounts the real custom
element** inside the framework root and forwards attrs+events (`fui:tools/gen-wrapper/genWrapper.mjs:18`,
`fui:tools/gen-wrapper/genWrapper.mjs:142`, `fui:tools/gen-wrapper/genWrapper.mjs:154`); `mount(el, props)`
does `createRoot(el)` / `createApp().mount(el)` and returns `{update, unmount}`
(`fui:tools/gen-wrapper/genWrapper.mjs:223-236`, `fui:tools/gen-wrapper/genWrapper.mjs:340-366`).

**Options.**

- **(a) Render into the stage — replace the native subject in the one introspection slot.** Prior art is
  unanimous: Storybook / Histoire / Ladle / Bit all render into a single canonical canvas the panels read,
  as plain rendered DOM, framework-agnostically (`/research/workbench-live-render-target/`, Findings 1–2).
  Because the wrapper mounts the *real* custom element, its native bubbling events reach the stage
  (event-log works), computed-style + ARIA inspection works, and the block declaration drives anatomy/traits
  unchanged. **Cost — three bounded amendments folded into #1030** (this is real wiring, *not* "zero", which
  was the item's original wrong claim): (1) **subject-node resolution** — `createRoot(el)` nests the element
  under the stage node, so panels keyed to `instance` must resolve the inner element; (2) **control routing**
  — the wrapper forwards mount-time props, not host attributes, so trait/DS toggles route through
  `instance.update(props)`; (3) **lifecycle** — `renderStage`'s reflexive `replaceChildren` must yield to the
  wrapper's `unmount()` to avoid leaking a framework root.
- **(b) Separate Polyglot live-preview pane beside source.** *Rejected* — more isolation, but it duplicates
  the entire introspection surface (a second event/computed-style/anatomy wiring) for **no precedent**: no
  surveyed explorer stands up a second introspection target. Its only unique value (render *beside* its
  source) is additive, not an alternative target, so it doesn't justify forking the introspection slot.

**Recommended default: (a) render into the stage** — strongly. Prior art is one-sided; the verified
architecture (real custom element, bubbling events, generic reads, existing declaration) makes the stage
path reuse the panels once the subject node is resolved, at materially less cost than (b)'s parallel surface.

**Skeptic:** SURVIVES-WITH-AMENDMENT. A refute-only skeptic returned REFUTED ("props ≠ attributes, the
custom element is absent, declaration-gated panels vanish, React events don't bubble"), but tracing
`fui:tools/gen-wrapper/genWrapper.mjs` disproved the premise — the live wrapper renders the *real* custom
element and forwards attrs+events. The attack's *correct* residue (nested subject node, attribute-vs-prop
control routing, `replaceChildren`-vs-`createRoot` ownership) is folded in as the three amendments above and
killed the original "zero new wiring" rationale, but did not flip the target: (a) still dominates (b) on
precedent and net cost.

## Supported by default (not decisions)

- **Render-beside-source preview is additive, not this call.** If a "live render adjacent to its source"
  view is wanted later, it can be added as a *second, non-introspected* display beside the Share panel
  without re-wiring the introspection panels — it does not compete with the stage as the introspection
  target. File separately under #912 if/when a consumer needs it; it is out of scope for #1594.
- **`exportAsCode` for a framework subject** (`fui:workbench/mount.ts:793-805`) should emit the wrapper /
  `?form` source rather than the host `instance.localName` markup (the known Storybook custom-`render`
  footgun). A #1030 build detail, not a render-target fork.

## Context — downstream

`#1030` (`blockedBy: 1594`) is the workbench-side build: cross-origin-import the `?form=react-live` module →
same-document `mount()`/`unmount()` at the chosen target → React error boundary + `window.onerror`/
`unhandledrejection` surfacing → the three Fork-1(a) amendments (subject-node resolution, prop-routed
control, `unmount()` teardown) → live browser-verify against a freshly-restarted :3002.
