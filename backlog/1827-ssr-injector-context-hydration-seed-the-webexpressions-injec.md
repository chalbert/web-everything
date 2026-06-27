---
kind: story
size: 5
status: open
blockedBy: ["1818"]
dateOpened: "2026-06-27"
tags: []
---

# SSR injector-context hydration: seed the webexpressions injector chain from server-rendered state

A general capability surfaced by #1818: when a block's declarative binding (`rows="[[ @ctx ]]"`) resolves against a **non-deterministic** (client-only) context, the server cannot resolve it at build — so on upgrade the client must seed the `webexpressions` injector chain from runtime state before the binding resolves. This card defines that hydration mechanism: how an injector-chain context is populated from client-only state so declarative `[[ ref ]]` bindings have something to resolve against. General to every block's declarative-binding form, not data-table-specific.

**Off the docs critical path.** Per #1818's determinism × interactivity rule, the docs `<table>` family (#1787 / #1600) is wholly **deterministic** — the build resolves its bindings server-side and emits plain `<table>`s, needing no client payload and no hydration. This card is required only by **app / dynamic** consumers whose context is client-only. It does **not** block the docs surface; verify a real non-deterministic consumer before building (per *Prep: Verify Mechanism Has A Consumer*).
