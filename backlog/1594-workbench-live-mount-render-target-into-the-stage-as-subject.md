---
kind: decision
parent: "912"
status: open
dateOpened: "2026-06-22"
tags: []
---

# Workbench live-mount render target — into the stage as subject vs separate Polyglot live-preview

Fork blocking #1030. The cross-origin React live-mount mechanism is proven end-to-end (#1501/#1518/#1556).
Before #1030's workbench-side build can be authored, one thing must be ruled: **where does the live render go**,
because it dictates where `mount(el, …)` points and how the inspector/event/anatomy panels introspect a
**non-custom-element** render.

## What you have to decide

Pick the render target for the cross-origin React/Vue live-mount in the workbench:

- **Fork A — render into the STAGE, replacing the native custom element as the subject.** The inspector reads
  computed styles / queries the stage DOM (`fui:workbench/mount.ts:7`), the event log listens on the stage, and
  the anatomy panel reflects the block's *declaration* (not rendered DOM) — so a React render placed in the
  stage is covered by all three panels with **no new introspection wiring**. React DOM events bubble normally;
  computed styles work on any DOM. **Residual to verify:** nothing in the stage path hard-assumes a
  custom-element subject (e.g. reads `.tagName`, calls `customElements.upgrade`, or expects the block's own
  shadow root).
- **Fork B — separate Polyglot live-preview panel.** Keep the live render beside its source (where source shows
  today, `fui:workbench/mount.ts:633`), but add **net-new introspection wiring** to feed inspector/event/anatomy
  from a non-custom-element render. More isolation, more code, less reuse.

**Fork-existence check (do before ratifying):** confirm Fork A is genuinely viable — i.e. the stage path does
NOT hard-require a custom element. If it does and can't be cheaply relaxed, the fork collapses to B; if it
doesn't, A dominates on reuse and B is only justified by a separate need to see render-beside-source.

## Downstream

`#1030` (`blockedBy: 1594`) is the workbench-side build: cross-origin-import the `?form=react-live` module →
same-document `mount()`/`unmount()` at the chosen target → React error boundary + `window.onerror`/
`unhandledrejection` surfacing → panel wiring → live browser-verify against a freshly-restarted :3002.
