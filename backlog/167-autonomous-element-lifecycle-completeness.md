---
type: issue
workItem: task
parent: "131"
status: resolved
dateOpened: "2026-06-07"
blockedBy: ["168"]
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [plugs, custom-elements, lifecycle, disconnect, form-associated, verify]
relatedProject: webcomponents
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Verify the autonomous custom-element lifecycle in the WE `plugs/` runtime (disconnect, attributeChanged, form callbacks)

> **Retargeted 2026-06-07 — corrected context.** This was originally written against the **legacy
> `plateau` repo** (continuation of #160). Plateau is now confirmed **abandoned** — do not work it or
> consult it. The live platform runtime is **`webeverything/plugs/`**, which is *more* complete than
> plateau ever was: a quick audit shows `we:plugs/webcomponents/CustomElement.ts` +
> `we:plugs/webregistries/CustomElementRegistry.ts` already define `connectedCallback`,
> `disconnectedCallback`, `attributeChangedCallback`, `observedAttributes`, `formAssociated`, and
> `formResetCallback`; `we:plugs/webcomponents/Element.insertion.patch.ts` already patches the insertion
> path; and WE already has a Playwright harness (`we:playwright.config.ts`) — so the plateau prerequisites
> (#168 harness, #162 insertion fix, #160 connect half) are all moot in the live repo.

So this is no longer a *build*; it is a **verification task against `plugs/`**: confirm the autonomous
custom-element path actually **drives** each callback end-to-end, and only open follow-up work for any
that don't fire.

- **`disconnectedCallback`** — confirm the patched removal path (`removeChild`/`remove`/`replaceChildren`)
  fires it on an autonomous element leaving the tree, so listeners/effects clean up (no leak on a
  parent `replaceChildren()`).
- **`attributeChangedCallback`** — confirm a rehydrated autonomous element gets attribute reactions for
  its `observedAttributes` after connect, not just the initial read.
- **Form-associated callbacks** — confirm `formResetCallback`/`formStateRestoreCallback`/
  `formDisabledCallback` are driven for `formAssociated` autonomous elements.

Acceptance: a real-browser test (the existing Playwright harness) proves each callback fires for an
autonomous element under the WE `plugs/` runtime; if all already pass, **resolve this with a note** that
the live runtime covers the lifecycle. Any genuine gap becomes its own scoped `plugs/` fix item.

---

## Resolution — verified 2026-06-09 (real Chromium)

**Finding: the gap is deeper than this item assumed.** New guard spec
`we:plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts` (5 tests, green) proves that the **scoped
`CustomElementRegistry` autonomous-element path is non-functional in a real browser before any of the
three callbacks can even be reached**:

- `CustomElementRegistry.define()` calls `new element()` to snapshot instance-field callbacks;
  constructing a custom-element class that is **not itself natively registered** throws
  `TypeError: Failed to construct 'HTMLElement': Illegal constructor`. The registry only registers a
  no-op stand-in natively, never the real class — so the real class is never legally constructible
  (same wall hits `Reflect.construct` in `pathInsertionMethods`).
- The existing jsdom **unit** tests pass only because jsdom permits constructing unregistered
  custom-element classes; Chromium does not — the green unit suite masked a hard real-browser failure.
- The item's premise that connect already works and only a "patched removal path" needed checking was
  **incorrect**: there is no removal patch, no attribute-change driver, and the stand-in lacks
  `static formAssociated`, so none of disconnect / attributeChanged / form callbacks have any driver.
- **Control (native path) is fully green:** `customElements.define(name, RealClass)` — the path
  `<auto-heading>` / `<validity-merge-field>` already use — drives connect/disconnect/attributeChanged/
  formReset natively with zero plug code. The browser is capable; the gap is the scoped registry design.

**Genuine gaps opened as follow-ups:**
- **#228** — make the scoped path construct real instances + drive the full lifecycle (disconnect,
  attributeChanged, form-associated). Root blocker; the three callbacks are enumerated as its
  acceptance, gated behind construction. The new guard spec flips to require callbacks fire when #228
  lands.
- **#229** — `we:webcomponents.spec.ts` is itself non-functional (its `page.setContent` fixtures load at
  about:blank, so `/plugs/*.ts` imports never resolve and all 8 tests time out). Found in passing.

This verification item is resolved; the work it surfaced lives in #228/#229.
