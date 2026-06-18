---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: plugs/webinjectors/declarativeInjector.ts
tags: []
---

# Declarative `<script type="injector">` domain/Protocol binding via customScriptTypes

Pull-forward slice from #002's ruling (@domain = Protocol). Implement the runtime declarative injector form: a `<script type="injector">` block, registered through the existing customScriptTypes hook, that binds a node's subtree to a Protocol (the @domain) and its impl — no build step, no resolver. Carries the id + association form from the gap analysis (script id, element injector="id" attribute, isolate to block parent inheritance). Demo-First on the conformance sandbox before any real block page. Excludes the build-time provide/consume DSL (separate, deferred).

## Progress

**Resolved 2026-06-11.** Implemented at
[we:plugs/webinjectors/declarativeInjector.ts](../plugs/webinjectors/declarativeInjector.ts), re-exported
from the webinjectors barrel.

**Note on the premise:** there is no existing `customScriptTypes` hook — `<script type="context">`
is only referenced in a comment, never implemented. So the script-scan + install mechanism is built
here from scratch (a small, self-contained runtime), not registered through a pre-existing hook.

**Form:** a `<script type="injector">` body is JSON `{ "domain": "@scope/name", "provide": <impl> }`
— `domain` is the Protocol identity (#002), `provide` the impl bound for it. Two association forms
from the gap analysis:
- **Implicit subtree inheritance** — the binding installs on the script's **parent element** via the
  real `InjectorRoot.ensureInjector` + `injector.set(domain, impl)`, so descendants resolve the domain
  through the normal injector chain and nothing outside the subtree sees it (isolation to the block
  parent).
- **Explicit `injector="id"`** — an element carrying `injector="<script id>"` binds to that named
  injector regardless of DOM position (cross-cutting).

**API:** `parseInjectorScript` (strict `{domain, provide}` parse — honours a falsy `provide`, only
absence errors), `applyDeclarativeInjectors(injectorRoot, root)` (scan + install, idempotent via a
WeakSet, skips one malformed block with a warning rather than throwing), `resolveDeclaredProvider`
(explicit-then-implicit resolution). No module resolution — impl binding rides the module-resolution
axis (#264/#271/#274), not this code. Build-time `provide`/`consume` DSL excluded (#279).

**Demo-First:** [we:demos/declarative-injector-demo.html](../demos/declarative-injector-demo.html) —
Region A declares `@date/core` and a descendant resolves it (✓); Region B implicit resolve misses
(isolation ✗); a Region-B element with `injector="dateProvider"` resolves despite being outside the
subtree (✓). Verified in-browser against the live dev server (no page errors).

**Tests:** [we:__tests__/unit/declarativeInjector.test.ts](../plugs/webinjectors/__tests__/unit/declarativeInjector.test.ts),
14 tests — parse valid/falsy/6× malformed, subtree install keyed by domain, descendant inheritance,
sibling isolation, explicit `injector="id"`, idempotency, one-bad-block resilience. All 185
webinjectors tests pass; gate green.
