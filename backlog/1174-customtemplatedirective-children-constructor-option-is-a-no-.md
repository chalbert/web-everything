---
type: issue
workItem: task
status: open
dateOpened: "2026-06-20"
tags: []
---

# CustomTemplateDirective {children} constructor option is a no-op in real browsers

The CustomTemplateDirective base class appends the `{children}` constructor option to `.content` from an INSTANCE-property connectedCallback (we:plugs/webdirectives/CustomTemplateDirective.ts:74-88), but a custom element's reaction callbacks are read from the PROTOTYPE at define() time — so the browser never calls the instance override and `{children}` is silently dropped in a real browser (jsdom reads the instance prop, so unit tests pass). Surfaced building the #1152 webportals demo: `new PortalDirective({children})` projected nothing until the demo populated `.content` directly. Fix: move the children-append to a prototype-level connectedCallback (chain via super); keep jsdom green. Any directive JS-constructed with `{children}` is affected.
