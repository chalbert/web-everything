---
kind: epic
status: open
locus: frontierui
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
tags: []
---

# webregistries plugged-mode root-scope determination — re-enable global customElements swap

Umbrella for re-enabling FUI webregistries plugged-mode root-scope (the #1387 regression). Sliced into #A (root-scope determination impl + unit test — bounded, gate-verifiable, no live re-enable) and #B (the high-stakes re-enable + live multi-app verification — a focused frontierui session owning the dev-server lifecycle). #1387's `window.customElements` swap white-paged the plateau site because root-parsed autonomous elements upgraded to an empty stand-in; the mitigation (root swap disabled in `fui:plugs/webregistries/index.ts`) is in place. *(Sliced 2026-06-22 by `/split all`.)*

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

> **Pre-flight (batch-2026-06-22) — size 8 → 13: needs `/split`, out of the batch pool.** Twice
> pre-flighted and released `outgrew`/`blocked-in-fact`: the deliverable's acceptance re-enables the
> `window.customElements` swap that white-paged the plateau site and requires confirming plateau-app + the
> WE site + FUI demos render with no `*-is-not-a-function` crash — a high-stakes live multi-app re-enable
> that needs an **owned** dev-server lifecycle, unavailable in a concurrent batch against the user's running
> :3000/:4000. `/split` into **(a)** root-scope determination impl + unit test (bounded, gate-verifiable, no
> live re-enable — batchable) and **(b)** the re-enable + live multi-app verification (focused frontierui
> session owning the servers). No design fork; the regression + fix shape are specified above.

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

## Pre-flight (batch-2026-06-22-1510-1483) — confirmed outgrew; the high-stakes live re-enable can't run safely in a concurrent batch

Claimed + ground the live FUI registry (`fui:plugs/webregistries/CustomElementRegistry.ts`, 201 lines). Confirmed the prior pre-flight's two reasons, with the mechanism now pinpointed:

- **Delicate upgrade machinery.** `define()` registers the real class under a private tag + an empty stand-in under the real tag, but the existing `upgrade(root)` (line 166) just delegates to `OriginalCustomElementRegistry.prototype.upgrade` — which only knows the **native** stand-in, not the scoped real class, so it never swaps a root-parsed element's prototype. The fix is a **root-scope determination path**: when the registry is the root, `define(name, RealClass)` must find already-parsed root-document `name` elements and swap prototype → real class + re-run the constructor/`connectedCallback` (the native upgrade reaction). `Object.setPrototypeOf` alone exposes prototype methods but **skips constructor-set state** — getting the upgrade reaction right on live root DOM is subtle, not a batch edit.
- **The acceptance is a high-stakes LIVE re-enable that a concurrent batch can't do safely.** It re-enables the very `window.customElements` swap that **white-paged the plateau site** (`rv.navigate is not a function`), and requires confirming plateau-app + the WE site + FUI demos render with no `*-is-not-a-function` crash. Doing that against the **user's running** servers (plateau :4000, WE :3000) risks **crashing their live environment**, and a concurrent batch does not own the server lifecycle to recover from a bad re-enable (the dev-server-lifecycle constraint — same class as #1030/#1234's live-verification carries). Then a cross-repo byte-replicate to `we:plugs/webregistries/CustomElementRegistry.ts`.

Carry-forward reason: **blocked-in-fact** — the acceptance's safe live multi-app re-enable verification needs an **owned** dev-server lifecycle, unavailable in a concurrent batch. **Recommend `/split`** into: (a) the **root-scope determination impl + unit test** (define an autonomous element *after* a matching tag is already in the body — the case #1387's suite misses; bounded, gate-verifiable, no live re-enable), and (b) the **re-enable + live multi-app verification** (focused frontierui session owning the server lifecycle). No new design fork (the regression + fix shape are clear). Released `open`.
