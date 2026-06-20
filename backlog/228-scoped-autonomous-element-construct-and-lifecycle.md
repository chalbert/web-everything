---
kind: story
size: 3
status: resolved
blockedBy: ["167"]
dateOpened: "2026-06-09"
dateStarted: "2026-06-10"
dateResolved: "2026-06-11"
graduatedTo: plugs/webregistries/CustomElementRegistry.ts (ensureNativelyConstructible)
tags: [plugs, custom-elements, lifecycle, registry, construction, scoped-registry]
relatedProject: webcomponents
parent: "167"
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Make the scoped `CustomElementRegistry` autonomous-element path constructible in real browsers (the root fix)

**Core slice of the scoped-autonomous-element work** — this item now owns the *root construction fix*;
the three lifecycle drivers it gates are spun out as sibling tasks under #167: **#261** (disconnectedCallback),
**#262** (attributeChangedCallback), **#263** (form-associated callbacks), each `blockedBy` this item.
Verification of #167 (real Chromium, `we:plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts`)
found the scoped autonomous-element path is **non-functional in a real browser before any lifecycle
question even arises**:

- `CustomElementRegistry.define()` does `const tempInstance = new element()` (to snapshot
  instance-field callbacks). Constructing a custom-element class that is **not itself natively
  registered** throws `TypeError: Failed to construct 'HTMLElement': Illegal constructor`.
- The same barrier hits `Reflect.construct(RealClass, [options])` in `pathInsertionMethods`'
  upgrade flow — the registry only natively registers a **no-op stand-in** (`class extends
  HTMLElement {}`), never the real class, so the real class can never be legally constructed.
- The existing jsdom **unit** tests (`we:webregistries/__tests__/unit/CustomElementRegistry.test.ts`)
  pass only because **jsdom permits constructing unregistered custom-element classes**; Chromium
  does not. So the green unit suite masks a hard real-browser failure.

The control test in the same spec proves the **native** path (`customElements.define(name, RealClass)`,
as used by `<auto-heading>` / `<validity-merge-field>`) drives connect/disconnect/attributeChanged/
formReset natively with zero plug code — i.e. the browser is fully capable; the gap is the scoped
registry's design.

**Root fix (gates everything else):** the scoped registry must produce real-class instances by a
legal means — e.g. register the real class (not a bare stand-in) natively under the tag, or
construct via the upgrade/`customElements.upgrade` path the browser actually supports — so an
autonomous scoped element can exist at all.

**Once construction works, the lifecycle drivers it gates are the three sibling tasks** (each
`blockedBy` this item, each currently with no driver in `plugs/` — split out 2026-06-10):
- **#261 — `disconnectedCallback`** — no removal-path patch (`removeChild`/`remove` unpatched;
  `replaceChildren` patched only as insertion). Removing a scoped element must fire it.
- **#262 — `attributeChangedCallback`** — no `setAttribute` patch / `MutationObserver`, stand-in
  declares no `observedAttributes`. A scoped element's `observedAttributes` must react.
- **#263 — Form-associated callbacks** — stand-in lacks `static formAssociated = true`, so
  `formResetCallback`/`formStateRestoreCallback`/`formDisabledCallback` never fire.

**Acceptance (this slice):** the **"upstream blocker"** guard in `we:autonomous-element-lifecycle.spec.ts`
inverts from "throws Illegal constructor" to "defines successfully" — the scoped registry produces a
legally-constructed real-class instance. Native control test stays green. (The three per-callback guards
flip in #261/#262/#263, which build on this construction fix.)

See #167 (verification that opened this), and the spec file for the exact, currently-passing
contract these fixes must overturn.

## Progress

**Resolved 2026-06-10.** Root construction fix landed in
[we:plugs/webregistries/CustomElementRegistry.ts](../plugs/webregistries/CustomElementRegistry.ts):
a new `ensureNativelyConstructible()` registers the **real autonomous class natively under a unique
private tag** (`scoped-ctor-N-el`), memoised per constructor via a `WeakMap`. Because the class is
now a *registered* constructor, both `new element()` in `define()` and `Reflect.construct(element, …)`
in `pathInsertionMethods`' upgrade flow are legal in a real browser — without colliding with the
user's tag (which keeps its no-op stand-in) or the customized-built-in path (guarded by
`!options?.extends`, this slice's exact scope).

The e2e contract in
[we:plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts](../plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts)
**inverted as specified**: the former "upstream blocker → throws Illegal constructor" guard now
asserts `define()` succeeds and produces a legally-constructed real-class instance; the native
control stays green; the three per-callback probes now assert construction succeeds (driving the
reactions is **#261** / **#262** / **#263**, each unblocked by this).

Gate: 5/5 e2e green, 696 plugs unit tests green, `check:standards` 0 errors.
