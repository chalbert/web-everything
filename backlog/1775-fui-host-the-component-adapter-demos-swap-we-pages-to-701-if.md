---
kind: story
size: 5
parent: "1353"
status: open
dateOpened: "2026-06-24"
relatedProject: webblocks
tags: [frontierui, demos, renderers, fui-build-gate]
---

# FUI-host the component-adapter demos, swap WE pages to #701 iframes, delete we:blocks/renderers/component

The FUI-build gate cleared: #1767 built the FUI component renderer
(`declarativeComponent` + the minimal `auto-define` `defineElement` dep) at
`fui:blocks/renderers/component/`, so FUI is now canonical. This is the
demo-swap+delete tail for the 4 WE consumer demos —
`we:demos/{component-adapter,mockup-to-standard,module-as-a-service,code-upgrader}-demo`:
build their self-bootstrapping FUI hosts, swap the WE pages to #701 `fuiDemo`
iframes, then delete `we:blocks/renderers/component/` (the runtime copy + its
`__fixtures__`); WE keeps only the contract + conformance vectors. Note: the
non-`component` renderers some of those demos also touch (moduleService,
upgrader, functionalComponent) are separate families with their own tails.
Mirrors the #1355 / #1531 pattern under #1353.
