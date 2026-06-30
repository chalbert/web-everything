---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-29"
tags: []
---

# Directive proposal — async region (await / then / catch + suspense fallback)

Net-new directive candidate (#1975 catalog). A region that renders pending, resolved, and error branches of a promise, plus a suspense-style fallback while descendants resolve. Universal across Svelte, Solid, Vue, React, Lit, Marko, Qwik. WE has async:boundary proposed in the webdirectives spec; this promotes it to a full three-branch directive. Tree-shape clean (the fetch logic is injected, not authored). Substrate: DOM Parts ChildNodePart. Decide at the #1963 bar.

## Example (proposed authoring)

```html
<!-- async:await promise="@user.profile" -->
  <template slot="pending"><we-spinner></we-spinner></template>
  <template slot="then" let="profile"><h2>${profile.name}</h2></template>
  <template slot="catch" let="err"><p class="error">${err.message}</p></template>
<!-- /async:await -->
```

- **Framework analog:** Svelte `{#await}/{:then}/{:catch}`, Lit `until()`, Solid `<Suspense>` + resource.
- **Substrate / migration target:** DOM Parts `ChildNodePart`. The promise is injected (a binding/injector value); the directive owns only the three-branch *shape*, not the fetch.
- **Form: Ⓣ template** *(confirmed 2026-06-29)* — the three branches are inert `<template slot>`s, stamped one-at-a-time by promise state; only the active branch is live DOM (a comment form would render all three).
