# #812 prep — how WE apps + straddle demos consume the 9 moved block-impl families post-deletion

**Date:** 2026-06-16 · **Item:** [#812](/backlog/812-how-we-apps-straddle-demos-consume-the-9-moved-block-impl-fa/) (`type: decision`, gates #697) · **Skill:** prepare-decision-item
**Point:** Brought #812 to Definition of Ready — research dissolved option (c), pass-0 re-scoped the affected set, leaving two grounded forks each with a bold default.

**Research page:** [/research/we-fui-runtime-block-composition/](/research/we-fui-runtime-block-composition/)

---

## Question

Once [#697](/backlog/697-delete-we-s-vendored-blocks-and-repoint-we-imports-build-to/) deletes WE's 9 vendored
block-impl families (`audit`, `background-task-surface`, `data-grid`, `lifecycle`, `master-detail`,
`selection`, `stepper`, `tree-select`, `type-ahead`), what runtime do the WE artifacts that **compose** those
families *as building blocks* consume? They can't iframe (a full app isn't one embeddable block), can't
`import '@frontierui/blocks'` ([#707](/backlog/707-reconcile-604-s-we-renders-real-fui-blocks-framing-with-the-/)
boundary, no `frontierui` vite alias), and [#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/)'s
in-document mount only mounts a *rendered* FUI thing — it gives an app no block **classes**.

## Key findings

1. **Prior-art (research topic) dissolves option (c).** Surveyed runtime micro-frontend federation —
   Webpack 5 Module Federation, Angular Native Federation, import-maps/ESM-CDN, web-components-as-federation-unit,
   the Geers/Fowler micro-frontend taxonomy, and real cross-trust SDKs (Stripe Elements, Intercom). **Verdict
   (high confidence): exposing composable component *classes* at runtime does not preserve a trust boundary —
   it collapses into a runtime import.** A class WE can instantiate/subclass/wire runs in WE's realm with WE's
   privileges and shared dep graph — identical blast radius to `import '@frontierui/blocks'`. Every
   boundary-*preserving* runtime pattern hands over an **opaque unit** (iframe / custom element / render-function
   signature), never a class. So option (c) "extend #765 to compose FUI block classes at runtime" **is** the
   #707-forbidden import with extra ceremony → struck, not a coherent branch. (This is the fork-reshaping the
   prepare rubric expects — the survey killed a fork.)

2. **Pass-0 re-scope — `durable-tier-verification` is mis-listed as a straddle.** It imports **only**
   `background-task-surface` (a moved family) — `we:demos/durable-tier-verification/durable-tier-verification.ts:28`
   + `:32` — with no retained family. So it is a plain **block-impl demo** whose subject *is* the block, already
   dispositioned by [#791](/backlog/791-reconcile-658-697-delete-and-repoint-with-the-604-iframe-bou/)
   (→ FUI, iframe-embed) + B1. Its only wrinkle is a service-worker + Background-Fetch dependency
   (`we:durable-sw.js`); a FUI-hosted page registers the SW on FUI's own origin, so the iframe embed is feasible —
   a footnote on #791/B1, **not a B3 fork**. Dropped from #812's affected set.

3. **The genuine B3 surface is heterogeneous → two forks.**
   - **Two exercise apps** (`loan-origination`, `auto-insurance`) compose 4–5 moved families *as classes*
     (`we:demos/loan-origination/app.ts:22-31`, `we:demos/auto-insurance/app.ts:14-21`) **plus** WE-only
     reference-runtime renderers FUI lacks (`renderers/{data-table,pagination,status-indicator,audit-timeline,decision-trace}`
     — FUI's `renderers/` has only `data-grid`). They need block **classes** to wire behaviors with domain logic,
     which (finding 1) only FUI can hold. Near-forced: **move to FUI**.
   - **One true straddle demo** (`loader-background-handoff-demo`) composes `resource-loader` (STAY,
     reference-runtime) + `background-task-surface` (MOVE) **live in one context** to prove the escalation handoff
     (`we:demos/loader-background-handoff-demo.ts:20-26`). Its producer half exercises a *WE-standard* concern
     (loader escalation), so the clean call is **decouple** — keep a WE demo of the escalation *contract*, let
     FUI's own surface demo cover the receiver.

4. **Grounding facts.** FUI already vendors the moved families byte-identical (`diff -rq` clean for
   audit/lifecycle/master-detail/stepper/tree-select/background-task-surface) and also carries its own
   `resource-loader`, so an FUI-hosted handoff demo has both families available. FUI's `renderers/` has **only**
   `data-grid` — the apps' other renderers are WE-only, so moving the apps up drags reference-runtime renderer
   *impls* into FUI (renderers are impl; WE keeps its own reference-runtime renderer demos for the data-table /
   pagination standards).

## Recommendation (defaults authored into the item, for the decision turn to ratify)

- **Fork 1 (exercise apps): (a) move to FUI.** The only path that lets the apps keep composing the real block
  classes; (d) decouple guts them, (b)/(c) struck.
- **Fork 2 (straddle demo): (d) decouple** — WE keeps the loader-escalation contract demo; FUI's surface demo
  covers the receiver. (a) move-whole-demo-to-FUI is the coherent alternative.

## Files created / modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics.json` | + `we-fui-runtime-block-composition` entry |
| `we:src/_includes/research-descriptions/we-fui-runtime-block-composition.njk` | new write-up |
| `backlog/812-…md` | rewritten to the prepared-fork shape; `preparedDate` set |
| `we:reports/2026-06-16-812-runtime-block-composition-boundary.md` | this report |
