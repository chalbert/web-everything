---
kind: story
size: 5
parent: "1483"
status: resolved
locus: frontierui
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:plugs/webregistries/CustomElementRegistry.ts (root native-delegate, mechanism 1)"
tags: []
---

# Rework webregistries root-scope upgrade: construction-delegation / native-delegate (replaces #1544 prototype-swap)

The #1544/#1560 root-scope upgrade swaps el prototype + copies own-keys, which CANNOT install #private fields (only the real constructor does). Proven 2026-06-22: re-enabling the root swap (#1545) white-pages plateau — route-view upgrades to RouteViewElement then throws 'Cannot write private member #routes'. Replace the prototype-swap mechanism so the browser's native machinery runs the real constructor on the existing node (installing #private fields). Two correct mechanisms: (1) root scope has exactly one class per tag, so define() delegates to the NATIVE registry (define the real class) and native upgrade-on-define handles already-parsed elements correctly — simplest, bulletproof for the root case; (2) general construction-delegation — the native stand-in's constructor does Reflect.construct(RealClass, args, standIn) so native construct/upgrade routes to the real constructor in ANY scope (the @webcomponents/scoped-custom-element-registry technique; #228 ensureNativelyConstructible already does Reflect.construct under a private tag). locus frontierui; FUI-only (no we:plugs byte-replica, #1047). Must keep #1544's passing scoped/non-private upgrade tests green. Blocks the re-enable (#1545).

## Progress

Built mechanism **(1)** — root native-delegation (batch-2026-06-22-1596-1593). Rationale for (1) over
(2): #1593's scope is the *root* upgrade (it blocks the root re-enable #1545); the body calls (1)
"bulletproof for the root case", and (2)'s any-scope construction-delegation exceeds this slice's mandate
(left for a later item if a scoped registry ever needs #private-bearing classes).

Change in `fui:plugs/webregistries/CustomElementRegistry.ts` `define()`:
- When the registry is the document-root scope and the element is autonomous, define the **real class**
  under the user's tag in the native registry (`originalCustomElements.define(name, element, options)`)
  instead of registering an empty stand-in. The browser's native **upgrade-on-define** then constructs
  every already-parsed `<name>` with the **real constructor** — installing `#private` field brands the old
  `Object.setPrototypeOf` + own-key copy could never carry (the exact cause of plateau's "Cannot write
  private member #routes" white-page).
- Skip `ensureNativelyConstructible`'s private-tag registration on the native-delegate path (a constructor
  registers natively once; the public-tag registration already makes it constructible) and record the tag in
  `nativeConstructionTagFor` so a later scoped define of the same class won't double-register.
- Skip the stand-in registration and the `#upgradeAlreadyParsed` prototype-swap on this path — the browser
  handled both. The prototype-swap path is **kept as a fallback** for the rare cross-scope collision (class
  already natively registered / tag taken), preserving #1544's scoped/non-private behavior.

Tests (`fui:plugs/webregistries/__tests__/unit/CustomElementRegistry.test.ts`): all 25 prior cases green
(incl. the #1544 root + non-root upgrade cases), plus a **new #private regression guard** — a root class
with a `#private` field read in `connectedCallback`. Falsified: stashing the impl and running the new test
against the old prototype-swap code reproduces "Cannot read private member #token" (same class as plateau's
`#routes`); with mechanism (1) it passes. 26/26 green; `tsc --noEmit` clean for the changeset.

**Not mine (concurrent):** `fui:plugs/webregistries/__tests__/unit/globalPatching.test.ts` has 1 red
(`window.customElements instanceof CustomElementRegistry`) caused by an uncommitted `fui:plugs/webregistries/index.ts`
edit that disables the root swap (the #1545 re-enable territory this slice unblocks) — verified present with
my changes stashed; stepped over per the gate-red-stop rule.
