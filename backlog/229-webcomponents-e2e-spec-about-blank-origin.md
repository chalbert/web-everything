---
type: issue
workItem: task
status: resolved
blockedBy: ["228"]
dateOpened: "2026-06-09"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
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

## Progress

**Resolved 2026-06-10.** All 8 tests pass against the live dev server (chromium). Changes:

- **Origin fix** — every fixture rebuilt with `page.goto('/')` + dynamic `import()` inside
  `page.evaluate` (the `autonomous-element-lifecycle.spec.ts` pattern), replacing the `setContent`
  about:blank fixtures that silently never loaded the `/plugs/*.ts` modules.
- **Bootstrap order** — the fixtures now apply the **webinjectors** patch before the components
  patch (per `plugs/bootstrap.ts`): the insertion patch and the upgrade walker call
  `this.getClosestInjector()`, supplied by the injectors patch.
- **Dead scoped-path assertions rebased** (the carried caveat) — `TestElement` now holds an
  `options` data field and renders nothing via lifecycle. Writing `textContent` in the constructor
  proved hostile to cloning (it doubled the clone's text and wiped deep-cloned children), and the
  scoped path does not drive `connectedCallback`. The clone tests now assert the genuinely-portable
  contract: the clone-handler carries `options` across `cloneNode` (shallow + deep) and preserves
  nested structure. A directly-constructed scoped element's `localName` is the private ctor tag
  (#228), not the user tag, so the deep-clone child is located structurally, not by user-tag
  `querySelector`. Cross-browser element registered through the scoped registry so it is natively
  constructible. Insertion-ordering tests kept as-is (only the origin/injector fix).
