---
kind: story
size: 5
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
tags: []
---

# Declarative telemetry emission seam — data-track behavior/directive over CustomTracker sink

Build the ratified (#1415) author-facing declarative emission seam for webanalytics: a data-track-style behavior/directive that binds an element's interaction (click/submit/view/focus/custom) to resolve(CustomTrackerRegistry).track(), document-level binding, no rendered surface. Reuses the already-built CustomTracker sink (#1012), contract, and Analytics Event Vocabulary protocol. Degrades to NoopTracker when no sink configured. Web Directives vs Web Behaviors home decided during build (both non-rendering annotation layers).

## Progress (batch-2026-06-21-1429-1487)

**Home decision — Web Behaviors (a `CustomAttribute`), not Web Directives.** Both are non-rendering
annotation layers, but a Web Directive is a *template/comment-structural* transform (`CustomComment`,
`CustomTemplateDirective`, multi-template slots) while `data-track` binds an *element's runtime
interaction* to a side effect — the `CustomAttribute` ("driven-by-interaction capability on a host")
shape, identical to every other behavior (and to #1429's gesture behavior). So it ships as a
`CustomAttribute` in the analytics plug, next to the tracker it calls.

Built in WE (`locus: we` — the runtime plugs still live in `we:plugs/` pending the #1234 repoint):
- **`we:plugs/webanalytics/TrackAttribute.ts`** (new) — the `data-track` `CustomAttribute`.
  Interaction-driven surface ⇒ honours `inert` (activate/deactivate). Grammar
  `data-track="[interaction:]eventName"` (interaction ∈ click|submit|view|focus|custom, default click);
  `data-track-on` names the custom DOM event; `data-track-props` carries static JSON properties.
  Resolves the backend per-scope (`InjectorRoot.getProviderOf(host, 'customTrackers')` → global
  `window.customTrackers` → silent `NoopTracker`), then calls `tracker.track(event, props)`. `view`
  uses a one-shot `IntersectionObserver` (immediate-fire fallback when IO is absent). Malformed
  `data-track-props` JSON is ignored — telemetry never throws.
- **`we:plugs/webanalytics/index.ts`** — exported `TrackAttribute` + `TrackInteraction`.
- **`we:plugs/webanalytics/__tests__/TrackAttribute.test.ts`** (new) — 5 vectors: default-click routing,
  focus prefix, props merge, named custom event, silent degrade with no registry. All green.

Reuses the #1012 `CustomTrackerRegistry`/`NoopTracker` + #1003 contract verbatim — no sink/contract
change. Registration stays the consumer's `registry.define('data-track', TrackAttribute)` (like other
behaviors).
