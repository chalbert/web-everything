---
kind: decision
size: 2
parent: "049"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#we-fui-embed-boundary
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
tags:
  - webcomponents
  - component
  - playground
  - demo
relatedReport: reports/2026-06-15-backlog-split-analysis.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-7 — Decide the converter playground's file home

The `<component>` converter playground (#038) exercises the **bidirectional** `<component>` ⇄ class
transform, which lives entirely in **frontierui** — `fui:frontierui/compiler/src/component-transform/index.ts`
(`transform(source, direction)`) — and shares the test fixtures at
`frontierui/compiler/__tests__/component-transform/fixtures/` (so the page can't drift from what passes).
WE has **no** import path to frontierui today (`vite.config.mts` has no `frontierui` alias and the proxy
block doesn't reach it; the existing `we:demos/component-adapter-demo.ts` deliberately runs WE's own *one-way
runtime twin* at `/blocks/renderers/component/declarativeComponent`, not this compiler).

This is a genuine binary placement, not a configurable dimension — a single page lives in one home. Both
branches are coherent (neither is flawed), so this is a decision to ratify, not a "support all."

**Fork — where does the playground page live?**

- **A. `frontierui/demos/` (native, recommended).** frontierui already has a demos surface + dev server
  (`frontierui/demos/`, vite :3001). The page imports `we:../compiler/src/component-transform/index.js`
  directly and reads fixtures from the sibling `__tests__` dir — **no cross-repo mechanism, no drift
  surface**. Matches the constellation layering instinct (the bidirectional compiler is a pure frontierui
  artifact; impl → FUI per the repo constellation). Cost: the playground sits in frontierui's
  demos rather than WE's public docs showcase next to the `<component>` *standard* page (`/blocks/component/`).
- **B. WE `demos/` + cross-repo import.** Keeps the playground in WE's public showcase next to the
  standard and the existing `component-adapter-demo`. Cost: must first build a real WE→FUI import path
  (vite alias / proxy / symlink) for **both** the module and its fixtures — net-new infra, an extra
  foundational slice, and a standing drift surface between repos.

**Default: A (frontierui/demos/).** It removes the "symlink mechanism" prerequisite #038's body calls its
biggest blocker, keeps the fixtures local (the anti-drift guarantee comes for free), and honours
impl → FUI. B's only real gain — co-location with the WE standard page — is a docs/cross-link concern,
solvable with a link from `/blocks/component/` to the frontierui-hosted playground.

## Ruling (2026-06-15) — A, plus a cross-surface iframe viewer

**Ratified: A — the playground lives in `frontierui/demos/`.** Demos are a frontierui artifact (impl
→ FUI per the repo constellation); the page imports the bidirectional compiler and reads its fixtures
locally, so there is no cross-repo import path to build and no drift surface. This is the home of record.

**Addendum — surface it on both via an iframe embed, not a cross-repo import.** B's only real gain
(co-location with the WE standard page at `/blocks/component/`) is recovered without B's cost: WE docs
embed the FUI-hosted demo through an **iframe-based component viewer** — a reusable embed that shows the
standard in action inside WE docs while keeping **FUI branding** (the demo is plainly a frontierui
deliverable). The demo still lives only in FUI; WE merely points an iframe at it. Captured as its own
build item (see close-out spin-off) — it generalises beyond the converter playground to any FUI demo WE
wants to showcase next to a standard.

**Next:** re-run `/split 038` straight into the **A** slice shape (2 sibling slices under #049: one-way
page → reverse direction + two-pane editor + bundled TS Compiler API).

## Why this blocks #038

#038's slice structure is **contingent on this fork** (see
[we:2026-06-15-backlog-split-analysis.md](../reports/2026-06-15-backlog-split-analysis.md), `/split 038` run):

- Under **A**: 2 sibling slices under #049 — one-way page (declarative→class, no TS-in-browser) →
  reverse direction + two-pane editor + bundled TS Compiler API.
- Under **B**: 3 slices — a foundational cross-repo import-mechanism task → one-way page → reverse
  direction + two-pane + TS-in-browser.

You can't split away the fork (it sits at the root of the DAG), so #038 is **could-not-split** until this
ratifies. On ratification, re-run `/split 038` straight into the decided slice shape.
