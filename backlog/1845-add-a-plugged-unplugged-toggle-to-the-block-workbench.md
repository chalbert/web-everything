---
kind: decision
size: 3
parent: "1836"
status: open
blockedBy: []
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-22-workbench-live-render-target.md
tags: [plugs, unplugged, workbench, dev-experience]
---

# Decide the plugged/unplugged toggle MECHANISM for the block workbench

> **Retyped story → decision (batch-2026-06-27 pre-flight).** Grounding the workbench before building surfaced
> a load-bearing mechanism fork the original story assumed away. `blockedBy: ["1842"]` cleared (the WeakMap
> path landed: `fui:plugs/core/ElementAttachment.ts`); the residual is a design call, not a blocker.

## Digest

The workbench exists to **show the gap** between plugged and unplugged, but a naive same-document re-mount is
*unfaithful*: plugged patches realm globals irreversibly, so an "unplugged" re-mount inherits them and falsely
reports "works." The mechanism is a real fork; recommended is **(c) a reload-scoped mode** — `?plug=on|off`
selects bootstrap-vs-unplugged at load, a clean realm reusing the existing URL-state serialization — with the
richer **(a) iframe-isolated stage** as the follow-up if a *live* toggle is wanted. **Confidence: medium** —
(b) is excluded on a correctness bug; (a) vs (c) is a live-vs-simple trade, and (c)'s substrate (a) reuses.

## The axis — why a same-document toggle can't be faithful

A live "switch the rendered component between plugged and unplugged" toggle collides with two grounded facts:

- **The workbench stage is single-realm by design.** `fui:workbench/mount.ts:6-11` states the inspector reads
  the rendered tree via plain same-document `querySelector` / `getComputedStyle` — *"There is NO postMessage
  manipulation protocol and NO WE↔FUI channel: chrome and block share one document."* The trait panel and
  inspector reach straight into the live tree (`fui:workbench/mount.ts:835`, `:961`).
- **Plugged is an irreversible global patch.** `fui:plugs/bootstrap.ts:114-184` patches the page realm's
  globals and prototypes — it *replaces* `window.CustomElementRegistry` (`:154`), sets `window.WebEverything`,
  `window.injectors`, the registries, etc., unconditionally and with **no teardown**. Once run, those globals
  **linger** — you cannot cleanly "un-plug" a realm.

So a same-document re-mount toggle is **not faithful**: after one plugged render the patched globals stay, and
an "unplugged" re-mount of a plugged-only capability would **falsely appear to work** (it picks up the lingering
globals) — defeating this item's stated purpose ("show the gap"). The faithful options force a **clean realm per
mode**, which is the fork below.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| **Fork 1 — toggle mechanism** | **(c) reload-scoped mode** (`?plug=on\|off` selects bootstrap-vs-unplugged at load; clean realm; reuses URL-state serialization) | (a) iframe-isolated stage per mode (live toggle, needs a postMessage DOM bridge, > size-3) | Medium — (b) excluded on correctness; (a) vs (c) is live-vs-simple |

## Fork 1 — the toggle mechanism

*Fork-existence:* **(b) same-document re-mount is the broken branch** — `fui:plugs/bootstrap.ts:114-184`
patches realm globals irreversibly, so an "unplugged" re-mount falsely inherits the plugged globals and shows a
false "works", which is exactly the gap the item exists to expose. With (b) excluded, the live fork is a genuine
either/or between the two *faithful* (clean-realm) options — **(a) iframe-isolated stage vs (c) reload-scoped
mode** — which cannot both be the first-cut mechanism: (a) is a live in-page toggle that severs the
same-document inspector contract (`fui:workbench/mount.ts:6-11`) and needs a new postMessage DOM bridge, while
(c) is reload-scoped and reuses the existing machinery. You build one first.

- **(c) page-reload per mode — RECOMMENDED.** A `?plug=on|off` (or `?mode=plugged|unplugged`) query param
  selects, at load, whether the page boots `fui:plugs/bootstrap.ts` (plugged) or the functional
  `fui:plugs/unplugged.ts` `register`/`upgrade` path (unplugged). Each load is a clean realm, so the gap is
  honest. It is cheap and reuses the workbench's **existing URL-state serialization** — `serializeState()` /
  the restore path already round-trip block, design-system, traits, axes, scheme, hc/fc/rtl/locale/cq through
  the URL (`fui:workbench/mount.ts:838-929`), so a reload does **not** lose workbench state; the mode is just
  one more serialized key. Cost: it is **not a live toggle** — flipping modes is a full reload, and you cannot
  see both modes on screen at once.
- **(a) iframe-isolated stage per mode** *(follow-up).* Render the block stage inside an iframe whose document
  boots the chosen mode, so each mode (or both, side by side) gets a clean realm in one page. Correct and the
  richer end-state (a live toggle, even simultaneous plugged-vs-unplugged), **but** it breaks the same-document
  inspector/trait panel (`fui:workbench/mount.ts:6-11`) — those synchronous `querySelector`/`getComputedStyle`
  reads must become an async postMessage bridge (precedent: the cross-origin Plateau-creator bridge
  `fui:workbench/manifestBridge.ts`, and the creator iframe at `fui:workbench/mount.ts:381-415`) — and that
  bridge build exceeds the size-3 budget. File it as the follow-up the day a live/side-by-side toggle is
  wanted; (c)'s `?plug` param + serialization is the substrate it reuses (each iframe is seeded with a
  serialized `?plug=…` URL), not throwaway work.
- **(b) same-document re-mount, accept lingering globals** — *Rejected.* Cheap, but the gap demo is
  **incorrect** for plugged-only capabilities: the lingering globals from a prior plugged render make an
  "unplugged" re-mount falsely succeed (`fui:plugs/bootstrap.ts:114-184`, no teardown). A demo that fakes the
  result it exists to expose is worse than no demo.

*Code example (default — Fork 1 (c)):* the workbench entry reads the mode param **before** mount and chooses
the boot path; the mode is added to the existing serialized URL state so the toggle is a link the page reloads
to.

```ts
// fui:demos/workbench.ts (entry) — pick the realm at load, before mount()
const params = new URLSearchParams(location.search);
const plugged = params.get('plug') !== 'off';          // default plugged; ?plug=off → unplugged realm
if (plugged) {
  await import('@frontierui/plugs/bootstrap');          // patches realm globals (irreversible — fine, fresh load)
} else {
  const { register, upgrade } = await import('@frontierui/plugs/unplugged');
  registerWorkbenchPlugs(register);                     // functional path, no global patch
  upgrade(document);
}
mount(document.getElementById('workbench')!, { /* … */ });

// chrome renders the toggle as a reload link, carrying the rest of serialized state (mount.ts:838-929)
const other = plugged ? 'off' : 'on';
toggleEl.href = `${location.pathname}?${withParam(serializeState(), 'plug', other)}`;
```

*Skeptic: SURVIVES — the (c) default held against a hard attack. "Reload loses workbench state" is **false**:
`serializeState()`/restore round-trip block, ds, traits, axes, scheme, hc/fc/rtl/locale/cq through the URL
(`fui:workbench/mount.ts:838-929`), so the mode is just one more key. "Iframe is free here because the
workbench already embeds iframes" is **false**: the only iframe is the cross-origin Plateau **creator** behind
an origin-validated postMessage (`fui:workbench/mount.ts:381-415`), whereas the **stage/inspector** is
deliberately same-document synchronous DOM (`:6-11`, `:961`), so option (a) genuinely needs a new bridge and
busts size-3. The one real residual — you cannot see plugged and unplugged **simultaneously** — is a larger
dual-stage feature outside this fork, and (c)'s `?plug` param + serialization is exactly the substrate that
future feature reuses, so (c) is a forward-compatible first cut, not a dead end.*

## Per-fork classification

The toggle mechanism is **pure FUI workbench impl** — the workbench is a FUI-owned product (block-explorer
chrome is decoupled from WE distribution), so there is **no WE contract surface** in this call: no protocol, no
intent dimension, nothing DI-injectable, no intent seam. It is a single FUI build choice (which clean-realm
mechanism to ship first), governed by most-flexible-default (ship the cheapest correct option now; the richer
live toggle is opt-in later). Nothing here graduates to a WE standard.

## Downstream once ratified

Ratifying **(c)** unblocks a clean size-3 FUI slice: add a `plug` key to the workbench's serialized state,
branch the boot path on it in `fui:demos/workbench.ts`, and render the mode toggle as a reload link in the
chrome. The richer live/side-by-side **(a)** iframe-stage + inspector-bridge is filed as the follow-up under
epic #1836 if/when a live in-page toggle is wanted.
