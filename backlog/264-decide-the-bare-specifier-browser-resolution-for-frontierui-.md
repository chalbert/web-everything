---
kind: decision
size: 2
parent: "125"
status: resolved
dateOpened: "2026-06-10"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: none
codifiedIn: "one-off"
crossRef: { url: /backlog/271-project-selectable-module-specifier-resolution-strategies/, label: "General resolution-strategy axis (#271)" }
tags: []
---

# Decide the bare-specifier resolution for @frontierui/jsx-runtime

**Resolved 2026-06-10.** The original framing (built `dist` vs vite src-alias vs
importmap — pick one mechanism) was wrong: `@frontierui/jsx-runtime` is an **ordinary
npm/workspace package**, and resolving its bare specifier is the ordinary bare-specifier
problem, not a jsx-specific one. The "jsx runtime" doesn't resolve anything — it's the
*target* of the `import jsx from '@frontierui/jsx-runtime'` that `jsxInject` prepends to
every compiled block. What resolves that name is whatever resolver the consuming
environment already has (vite/node via `node_modules` + `exports`; a raw browser via an
importmap). The #239 footgun — the name resolving to **WE's own source** — exists only
because it was *hand-mapped* there; a normal package would never be.

## Ruling

- **The only lock is the contract.** `@frontierui/jsx-runtime` resolves to the
  **package**, via the package's `exports` field — never to WE source, never to a raw
  in-repo path. That contract is the single invariant (consistent with "protocol is the
  only lock"); it is what makes deleting copy #2 (#265) safe.
- **The runtime location is project-configurable.** *Default* = the
  `@frontierui/jsx-runtime` package, consumed the normal way any workspace dependency is
  (vite/node resolution through `exports`). *Overridable* = a **URL** (e.g. a CDN or a
  served location), because a no-bundler/CDN project legitimately points the same bare
  specifier at a URL instead of an installed package. So the *location* is config; the
  *name* and `exports` contract are fixed.
- **The mechanism is NOT fixed and NOT jsx-specific.** importmap vs `node_modules`+`exports`
  vs CDN URL vs alias are how *different kinds of consumer* each satisfy the same contract —
  an array of strategies the **project** selects from, not a single baked answer. That
  general axis is **#271** and is explicitly **not** part of this jsx ruling.

## Decoupled from jsx — does not gate #265

This decision no longer blocks the jsx dedupe. #265 (repoint FUI blocks, delete copy #2)
needs only the narrow ruling above — *configurable location, package default, URL
override, `exports` is the contract* — which is now made. The broad "how does a project
resolve module specifiers" question is its own item (**#271**, linked via `crossRef`, not a blocker edge — this
case is already resolved; #271 just generalises it) and must not delay jsx. Treat the jsx
runtime as a normal workspace dependency.
