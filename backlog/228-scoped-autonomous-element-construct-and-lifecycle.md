---
type: issue
workItem: story
size: 8
status: open
blockedBy: ["167"]
dateOpened: "2026-06-09"
tags: [plugs, custom-elements, lifecycle, registry, disconnect, attribute-changed, form-associated]
relatedProject: webcomponents
parent: "167"
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Make the scoped `CustomElementRegistry` autonomous-element path functional in real browsers (construct + drive the full lifecycle)

Verification of #167 (real Chromium, `plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts`)
found the scoped autonomous-element path is **non-functional in a real browser before any lifecycle
question even arises**:

- `CustomElementRegistry.define()` does `const tempInstance = new element()` (to snapshot
  instance-field callbacks). Constructing a custom-element class that is **not itself natively
  registered** throws `TypeError: Failed to construct 'HTMLElement': Illegal constructor`.
- The same barrier hits `Reflect.construct(RealClass, [options])` in `pathInsertionMethods`'
  upgrade flow — the registry only natively registers a **no-op stand-in** (`class extends
  HTMLElement {}`), never the real class, so the real class can never be legally constructed.
- The existing jsdom **unit** tests (`webregistries/__tests__/unit/CustomElementRegistry.test.ts`)
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

**Once construction works, drive the lifecycle the platform spec defines (each currently has no
driver in `plugs/`):**
- **`disconnectedCallback`** — there is **no removal-path patch**. `removeChild`/`remove` are
  unpatched; `replaceChildren` is patched only as an *insertion* method and never disconnects the
  children it removes. Removing a scoped element must fire it (no listener/effect leak).
- **`attributeChangedCallback`** — no `setAttribute` patch / `MutationObserver`, and the native
  stand-in declares no `observedAttributes`. A scoped element's `observedAttributes` must react.
- **Form-associated callbacks** — the stand-in lacks `static formAssociated = true`, so the
  browser never associates it; `formResetCallback`/`formStateRestoreCallback`/`formDisabledCallback`
  never fire. Form-associated scoped elements must drive these.

**Acceptance:** the three "currently blocked by the scoped-define barrier" guards in
`autonomous-element-lifecycle.spec.ts` flip — rewrite each to construct a scoped element and assert
its callback fires under the named DOM mutation (remove / setAttribute / form.reset). The
"upstream blocker" guard's assertions invert from "throws Illegal constructor" to "defines
successfully". Native control test stays green.

See #167 (verification that opened this), and the spec file for the exact, currently-passing
contract these fixes must overturn.
