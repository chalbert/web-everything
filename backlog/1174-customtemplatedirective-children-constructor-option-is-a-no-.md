---
kind: task
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:plugs/webdirectives/CustomTemplateDirective.ts"
tags: []
---

# CustomTemplateDirective {children} constructor option is a no-op in real browsers

The CustomTemplateDirective base class appends the `{children}` constructor option to `.content` from an INSTANCE-property connectedCallback (we:plugs/webdirectives/CustomTemplateDirective.ts:74-88), but a custom element's reaction callbacks are read from the PROTOTYPE at define() time — so the browser never calls the instance override and `{children}` is silently dropped in a real browser (jsdom reads the instance prop, so unit tests pass). Surfaced building the #1152 webportals demo: `new PortalDirective({children})` projected nothing until the demo populated `.content` directly. Fix: move the children-append to a prototype-level connectedCallback (chain via super); keep jsdom green. Any directive JS-constructed with `{children}` is affected.

## Resolved (batch-2026-06-20)

`we:plugs/webdirectives/CustomTemplateDirective.ts` — the instance-property `connectedCallback` set in the constructor is gone; the `is`-attribute + `{children}` projection now live in a real **prototype** `connectedCallback`, so the browser actually invokes them at define() time. The contract is now standard super-chaining: a subclass that overrides `connectedCallback` MUST call `super.connectedCallback()`. Updated the one real subclass (`we:plugs/webportals/PortalDirective.ts` — `super.connectedCallback()` before `#activate()`, so `.content` is populated before projection) and the test directive; added a regression test asserting `connectedCallback` is a prototype method, not an instance-own property (mirrors the CustomComment guard). Cleaned the #1152 demo (`we:demos/webportals-conformance-demo.ts`) back onto the now-correct `{children}` path. All 84 webdirectives+webportals tests green; `check:standards` 0 errors.
