---
kind: story
size: 5
parent: "1353"
blockedBy: []
status: open
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
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

## Pre-flight (claimed 2026-06-24) — the delete is blocked-in-fact; `blockedBy` chain added; released

Claimed and ground the real import tree before touching anything. The card's premise — *swap 4
demos, then delete the renderer* — rests on a false assumption: **`we:blocks/renderers/component/`
is not a deletable leaf, it is the shared parse/generate transform core** of the whole adapter
constellation. #1730's own block-note confirms this from the other side: *"`serve()` sits on the
shared `we:blocks/renderers/component` / `jsx` / `functional` transform core."*

**Who still value-imports the kernel WE-side** (runtime grep: zero WE *runtimes* do, but):
- **4 demos** — only `we:demos/component-adapter-demo` is pure-component. The other 3
  (`mockup-to-standard`, `module-as-a-service`, `code-upgrader`) also import `upgrader/*` and/or
  `module-service/*`, **neither of which exists FUI-side**, so they can't be iframe-swapped yet.
- **6 WE unit tests** — `moduleService` (asserts `serve()===generateClassSource(parseDefinition(DEF))`),
  `upgrader`, `functionalComponent` (`generateFunctionalSource(parseDefinition(…))`), `autoDefine`
  (`explicitAutoDefine` + the kernel), `definitionRegistry` (the `component-cases` vectors),
  `declarativeComponent` — all testing families **still WE-resident**.
- **`we:tools/maas/vite-plugin.ts`** — consumes the `component-cases` vectors.

So the kernel delete is the **last** step of the renderer-relocation program: it can only leave WE
once every consuming family relocates. The correct blocker chain (added):
- **#1730** — relocate the MaaS / module-service runtime out of WE (itself `blockedBy: #1771`); owns
  `moduleService.test`, `definitionRegistry.test`, the maas vite-plugin, and the maas/code-upgrader demos.
- **#1777** — relocate the upgrader renderer family (owns `upgrader.test`, mockup + code-upgrader demos).
- **#1778** — relocate the functional-component renderer (owns `functionalComponent.test`).
- **#1779** — relocate the auto-define registry + strategies (owns `autoDefine.test`).

**Note on the imprecise body:** the `component-cases` fixtures ARE the conformance vectors WE keeps —
they do **not** get deleted (the body's "delete … its `__fixtures__`" conflicts with "WE keeps …
conformance vectors"; vectors stay, only the runtime `we:blocks/renderers/component/declarativeComponent.ts`
+ `auto-define` glue leave). FUI's existing `fui:demos/component-converter.ts` is the build-time AST
transform (#038), **not** a host for the #1767 runtime renderer — so the component-adapter FUI demo is
genuine new work, not a reuse.

**In-scope when unblocked:** swap `we:demos/component-adapter-demo` to a #701 FUI iframe over a new
self-bootstrapping `fui:demos/component-adapter-demo` (the only pure-component demo, deliverable the
moment its FUI host exists), relocate `declarativeComponent.test` (→ FUI / conformance → Plateau), and
delete the WE runtime renderer; the 3 mixed demos swap with their family relocations.
Released `active → open`.
