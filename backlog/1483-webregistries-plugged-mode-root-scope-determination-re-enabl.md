---
kind: story
size: 8
status: open
locus: frontierui
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
tags: []
---

# webregistries plugged-mode root-scope determination — re-enable global customElements swap

FUI #1387 turned on webregistries plugged-mode (swapped window.customElements for the scoped CustomElementRegistryImpl). Its define() registers an empty native stand-in under the real tag, leaning on a per-scope determination pass that only fires for elements entering a scoped shadow host — there is NO root-document path. So autonomous custom elements parsed in top-level HTML (e.g. route-view) upgraded to the empty stand-in, lost their real prototype, and crashed at runtime (took down the plateau site). Mitigated by disabling the root swap in fui:plugs/webregistries/index.ts. This item: implement root-scope determination so root-parsed elements upgrade to their real class, then re-enable the swap.

## Background

`fui:plugs/webregistries/index.ts` `applyPatches()` was a no-op until #1387 (committed
2026-06-21). The no-op meant `window.customElements` stayed native, so
`customElements.define('route-view', RouteViewElement)` in `fui:plugs/bootstrap.ts` upgraded the
pre-parsed `<route-view>` to the real class — routing worked. #1387 made `applyPatches()` swap
`window.customElements` for `new CustomElementRegistryImpl()` (`fui:plugs/webregistries/CustomElementRegistry.ts`).

That impl's `define()`:
1. registers the real class natively under a unique **private** tag (`ensureNativelyConstructible`);
2. registers an **empty stand-in** `class extends HTMLElement {}` (`#getStandInElement`) natively
   under the **real** tag, so the browser can parse the tag.

The stand-in is meant to be resolved to the real class by a per-scope "determination" pass — but that
pass only runs for elements entering a **scoped (shadow) host**. There is no path that determines
autonomous custom elements parsed in the **top-level document**, so `<route-view>` stayed the empty
stand-in (no `navigate`), and `syncAuthShell()` in `plateau:src/main.ts` threw
`rv.navigate is not a function`, aborting the route pipeline → white page. #1387's webregistries unit
tests passed because they exercise only scoped/programmatic paths, never a root-parsed element.

This breaks **every** consumer of the FUI bootstrap (plateau-app, the WE docs site, FUI demos) that
has an autonomous custom element in its top-level HTML — not just plateau.

## Current mitigation (in place)

`fui:plugs/webregistries/index.ts` `applyPatches()` now keeps the `CustomElementRegistry` **class**
swap and the `attachShadow` scoped-init patch (both used by scoped consumers, both harmless) but
**skips** the root `redefine(window, 'customElements', …)`. Nothing depended on a plugged root
registry since it was a no-op until #1387, so this restores prior working behavior with no loss.

## Work

- Implement a root-scope determination path: when the scoped registry serves as the **root**
  registry, `define()` (or `applyPatches()` over the existing tree) must upgrade already-parsed
  root-document elements to their real class — swap prototype + run `connectedCallback`, mirroring how
  the native registry upgrades on `define`.
- Cover it with a test that defines an autonomous element **after** a matching tag is already parsed in
  the document body (the case the existing suite misses).
- Re-enable the root `window.customElements` swap in `fui:plugs/webregistries/index.ts` and confirm
  plateau-app + the WE site render with no `*-is-not-a-function` upgrade crash.

Relates to #1387 (the regression), #1304 (the plug reconciliation epic). Byte-replicate the fix back
to `we:plugs/webregistries/CustomElementRegistry.ts` (identical source today).

## Pre-flight (batch-2026-06-21-1429-1487) — outgrew (5 → 8): deep impl + a high-stakes live re-enable

Claimed and grounded. Mitigation confirmed in place: `fui:plugs/webregistries/index.ts` `applyPatches()`
keeps the class swap + `attachShadow` patch but the root `redefine(window, 'customElements', …)` is
**commented out** (line ~95). Set `locus: frontierui` (this is FUI runtime impl; defaulted to `we`). The
work is well past a story·5 batch-tail slot for two concrete reasons:

- **The impl is deep custom-element-upgrade machinery.** Root-scope determination must, when the scoped
  registry is the *root*, find already-parsed root-document elements matching a tag at `define()` time,
  **swap their prototype** from the empty stand-in to the real class and run `connectedCallback` — mirroring
  how the native registry upgrades. That is the subtle part #1387's stand-in design skipped (its tests only
  exercised scoped/programmatic paths); getting prototype-swap + lifecycle ordering right on live root DOM
  is focused work, not a batch edit.
- **The acceptance is a high-stakes LIVE multi-app re-enable.** The deliverable re-enables the very
  `window.customElements` swap that **took down the plateau site** (white page via `rv.navigate is not a
  function`), and explicitly requires confirming **plateau-app + the WE site + FUI demos** render with no
  `*-is-not-a-function` upgrade crash — real-browser verification across ≥2 running apps. Re-enabling a
  site-crashing swap without that full live verification would be reckless. (Compounding it: the WE site's
  own cold-start bootstrap currently **crashes on the separate `anchor` bug #1503**, so a clean WE-site
  "renders with no crash" read is itself blocked until #1503 is fixed.) Then byte-replicate to
  `we:plugs/webregistries/CustomElementRegistry.ts`.

Re-sized 5 → 8, carry-forward reason **outgrew** — routes to a focused FUI session that owns the
plateau-app + WE dev servers for the live re-enable verification. No new design fork (the approach is
specified). Released to `open`.
