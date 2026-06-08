---
type: issue
workItem: task
parent: "131"
status: open
dateOpened: "2026-06-07"
tags: [plugs, custom-elements, lifecycle, disconnect, form-associated, verify]
relatedProject: webcomponents
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Verify the autonomous custom-element lifecycle in the WE `plugs/` runtime (disconnect, attributeChanged, form callbacks)

> **Retargeted 2026-06-07 — corrected context.** This was originally written against the **legacy
> `plateau` repo** (continuation of #160). Plateau is now confirmed **abandoned** — do not work it or
> consult it. The live platform runtime is **`webeverything/plugs/`**, which is *more* complete than
> plateau ever was: a quick audit shows `plugs/webcomponents/CustomElement.ts` +
> `plugs/webregistries/CustomElementRegistry.ts` already define `connectedCallback`,
> `disconnectedCallback`, `attributeChangedCallback`, `observedAttributes`, `formAssociated`, and
> `formResetCallback`; `plugs/webcomponents/Element.insertion.patch.ts` already patches the insertion
> path; and WE already has a Playwright harness (`playwright.config.ts`) — so the plateau prerequisites
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
