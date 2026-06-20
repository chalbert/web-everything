---
kind: task
parent: "162"
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-07"
dateResolved: "2026-06-07"
tags: [plateau, plugs, dom-patch, testing, playwright, e2e]
relatedProject: webblocks
crossRef: { url: /backlog/162-insert-adjacent-element-patch-trailing-node-bug/, label: "#162 (surfaced this)" }
---

# Playwright `evaluate` returns `undefined` for objects/arrays on `plugs/patch` pages

On any page that bootstraps `plateau/src/plugs/patch` (the platform DOM patches), Playwright's
`page.evaluate(() => …)` silently resolves to **`undefined`** whenever the callback returns an
**object or array** — but returns fine for primitives (number, string, boolean). Reproduced while
writing #162's e2e:

```js
await page.evaluate(() => 1 + 1);                 // → 2          ✓
await page.evaluate(() => el.id);                 // → "host"     ✓
await page.evaluate(() => ({ a: 1 }));            // → undefined  ✗
await page.evaluate(() => [1, 2, 3]);             // → undefined  ✗
```

Playwright serializes complex return values through an in-page protocol; one of the patched globals
(`Node`/`Element`/`Document`/`HTMLElement`/`DocumentFragment` prototypes, or a `window.*` define in
`we:patch.ts`) disturbs it — likely the overridden `append`/`appendChild` or an `Object`/`Array`
interaction Playwright's structured-clone path relies on. Both #145 and #162 specs work around it by
returning only primitives (e.g. joining ids into a `'a|b|c'` string), but that's a sharp edge every
future e2e against the patched runtime will hit.

- Bisect which patch breaks it (comment out `we:patch.ts` imports one at a time against a minimal
  `evaluate(() => ({a:1}))` smoke test) and identify the exact override.
- Fix it if the override is overreaching, or document the constraint prominently next to the e2e
  harness and provide a tiny helper (return-as-JSON-string) if it can't be fixed.

Acceptance: either `page.evaluate` returns objects/arrays normally on a patched page, or the harness
documents the limitation with a sanctioned helper so specs don't each rediscover it.

## Resolution

Took the **fix** branch (preferred). Runtime-bisected the patched page (deleting each patched `window`
global in turn — none was the culprit), then probed the constructor/`instanceof` health and found the
exact cause: `plateau:plateau/src/plugs/custom-elements/Node.patch.ts` defined a custom
`Node[Symbol.hasInstance]` as `instance instanceof OriginalNode || instance instanceof Node`. `Node`
there *is* the constructor the hasInstance is defined on, so the second branch re-invoked itself —
infinite recursion for any non-node value (`{a:1}`, `[1,2,3]`), throwing "Maximum call stack size
exceeded". Playwright's return serializer runs `value instanceof Node`, so that throw made every
object/array return silently come back `undefined`; primitives skip the check and were unaffected.

Fix: the hasInstance now returns just `instance instanceof OriginalNode` (every patched node is built
via `Reflect.construct(OriginalNode, …)`, so it's sufficient and terminating). Guarded by a new
plateau e2e spec `we:e2e/patch-evaluate-serialization.spec.ts` (objects + arrays serialize; real
`instanceof Node` still correct; primitives unaffected) and the now-stale "primitives only" note in
`we:e2e/insert-adjacent-element.spec.ts` was updated. `we:HTMLElement.patch.ts`'s separate custom
hasInstance was checked and returns `false` cleanly (no recursion) — no change needed.
