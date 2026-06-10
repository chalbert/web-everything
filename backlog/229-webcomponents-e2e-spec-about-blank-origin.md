---
type: issue
workItem: task
status: open
blockedBy: ["228"]
dateOpened: "2026-06-09"
tags: [plugs, custom-elements, e2e, playwright, test-infra]
relatedProject: webcomponents
parent: "167"
---

# Fix `webcomponents.spec.ts` — `page.setContent` gives an about:blank origin, so its `/plugs/*.ts` imports never load (all 8 tests time out)

Found while verifying #167. `plugs/__tests__/e2e/webcomponents.spec.ts` builds its fixture with
`page.setContent('<script type="module">import … from "/plugs/…ts"</script>')`. `setContent` yields
an **about:blank** document origin, so the absolute `/plugs/*.ts` module specifiers resolve against
nothing and the module never executes — every test then times out at
`page.waitForFunction(() => window.TestElement !== undefined)`. Confirmed: all 8 tests in the file
fail with `Test timeout of 30000ms exceeded` against the running dev server.

The fix pattern is the one used by the #167 verification spec
(`plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts`): `page.goto('/')` first to establish a
real same-origin base, then load the plug modules via dynamic `import()` inside `page.evaluate`.

**Caveat to carry into the fix:** several of these tests also assume `new TestElement()` +
`appendChild` drives `connectedCallback` on the *scoped* path — which #228 shows is impossible in a
real browser (Illegal constructor). So this isn't a pure origin fix: the assertions must be
rebased onto either the native path or whatever #228 lands. Coordinate with #228; this item may
reduce to "delete/rewrite the dead scoped-path assertions and keep the genuinely-portable ones
(clone behavior, insertion ordering)".

**Acceptance:** `webcomponents.spec.ts` runs green against the dev server (no timeouts), testing
real behavior rather than silently dead about:blank fixtures.
