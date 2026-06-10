---
type: idea
workItem: story
size: 5
parent: "136"
status: open
blockedBy: ["136"]
dateOpened: "2026-06-08"
tags: [droplist, autocomplete, anchor, frontierui, migration, traits]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /backlog/136-anchor-trait-behavior/, label: Anchor trait behavior }
---

# Droplist → Frontier UI migration: remaining follow-ups

The droplist trait family + `<auto-complete>` was brought into the **live reference implementation,
Frontier UI** (`frontierui/blocks/droplist/`) on 2026-06-08 — see
[#136](/backlog/136-anchor-trait-behavior/) and [#149](/backlog/149-anchor-positioning-strategy-provider/).
What landed and was validated: the positioning library (native [#161 fix] + js + resolve), the seven
behaviors (Anchor, Anchored, Clearable, Filter, FocusDelegation, LiveStatus, Selection), the
`<auto-complete>` element, a demo, 26 unit tests + 4 real-Chromium e2e (full Frontier UI suite green).
Review bug-fixes were folded in (LiveStatus mounted, Anchor `boundaryEl` containment, client-seeded
option ARIA parity, shared `resolveRef`/`descendants` dedup).

This item tracks the deliberately-deferred remainder so it isn't lost:

- **Declarative trait registration** — the behaviors are currently composed *programmatically* by
  `<auto-complete>`. To support standalone declarative use (`<ul anchored="bottom-start;flip">`,
  `<input filter="async">`, etc.) they need Frontier UI's lazy **trait manifest** + Enforcer
  registration (`defineLazy` / `traitManifest` / `vite.config` `traitEnforcer`), and value-string
  option parsing (the `@withOptions`/`FieldValue` equivalent that was dropped during the port).
- **JS-strategy real-browser demo + injector swap** (the open part of #149) — a plugged Frontier UI
  demo with an injector root, a one-line `injector.set('customContexts:positioningStrategy', …)`
  toggle, and an e2e that flips `data-positioning-strategy` native↔js.
- **Port `CompositeWidget` + `Windowed`** — not needed by `<auto-complete>`, so not yet carried over.
  The plateau `CompositeWidget` rewrite also **dropped Escape handling** (clearSelection + blur) with
  no test — decide whether to restore it (or assign Escape to the anchor/disclosure layer) when porting.
- **Custom-elements runtime patches** — the plateau work included two genuine, well-tested fixes
  (`insertAdjacentElement` arg-slicing; `Node[Symbol.hasInstance]` infinite recursion). Check whether
  Frontier UI's `plugs/webcomponents` substrate has the equivalent bugs and port the fixes if so.
- **Full unit-test parity** — port plateau's richer suites (Filter async respond/reject stale-guard,
  FocusDelegation/Selection split, Anchor open/dismiss matrix, Anchored delegation) beyond the focused
  set carried over.
- **Retarget [#179](/backlog/179-native-resize-is-a-noop/) / [#180](/backlog/180-native-shift-maps-to-flip-start/)**
  — both describe gaps in the native strategy whose home is now
  `frontierui/blocks/droplist/positioning/native.ts` (their bodies still cite plateau paths).

Acceptance: each bullet either landed (with tests) in Frontier UI or is split into its own item; the
droplist family is usable both programmatically (done) and declaratively (this item).
EOF
echo "created #193"; cd /Users/nicolasgilbert/workspace/webeverything && npm run check:standards 2>&1 | tail -4