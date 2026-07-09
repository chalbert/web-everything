---
kind: story
size: 3
parent: "1836"
status: resolved
blockedBy: ["1545"]
dateOpened: "2026-06-27"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "none"
tags: []
---

> **Pre-flight (batch-2026-06-27, updated 2026-06-27 — #1839 ruling landed) — build-vs-residue disposition is forked.**
> The residue bar #1839 decides has **resolved** (`we:docs/agent/platform-decisions.md#plugged-only-residue-bar`),
> so the "record them plugged-only residue" branch is now actionable: apply the strict contract-portability bar
> and mark accordingly. The **unplugged-drive** branch still waits on the webregistries root `customElements`
> swap, which is **separately disabled and human-gated** (#1545 `humanGate: setup`, #1483) — so `blockedBy` is
> re-pointed to **#1545** (the real remaining open dependency for the build path). Pick the branch per #1839's bar.

# webbehaviors + webregistries unplugged members — drive defineLazy/trait-manifest and root-registry swap via the unplugged register/upgrade API, or record plugged-only

Re-audit #1840: webbehaviors defineLazy/trait-manifest is bootstrap-only (fui:plugs/bootstrap.ts:287-290, registerTraits + virtual:trait-manifest, 'Unplugged never imports this file'); webregistries root customElements swap is only exercised plugged (and is separately disabled, we:backlog/1483, we:backlog/1545). Drive both via the unplugged register/upgrade API, or record them plugged-only residue per #1839. Locus: FUI. Relates #1483/#1545. See we:reports/2026-06-27-unplugged-functional-re-audit.md.

## RESOLVED 2026-07-09 — both driven unplugged (no residue)

#1545 landed (root swap re-enabled via #1593's native-delegate) since this item was filed, unblocking the
build branch. Applied the residue bar (#1839) to both capabilities: neither requires intercepting a native
method/constructor the plug holds no handle to — both are reachable through the plug's own explicit
`register`/`define`/`upgrade` API — so **neither is residue**; both are driven:

- **webbehaviors defineLazy/trait-manifest** — `registerTraits` was already a pure function over a
  `CustomAttributeRegistry` instance (no `fui:plugs/bootstrap.ts` dependency); the gap was purely a missing
  proof. Added `fui:plugs/webbehaviors/__tests__/unit/traitManifest.unplugged.test.ts` (4 cases): lazy-load
  + activate, eager sync activation, downgrade/deactivate, and non-invasiveness — all driven through the
  shared `fui:plugs/unplugged.ts` `register()`/`upgrade()`/`downgrade()` API, no global patch, no bootstrap
  import.
- **webregistries root customElements swap** — the observable contract (an already-parsed root element
  upgrades to its real class, `#private` fields intact — the #1593 fix) is reachable via the registry's own
  `setRootScope()` + `define()` API without ever touching `window.customElements`/`window.CustomElementRegistry`.
  Added two tests to `fui:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts`: already-parsed
  root-element upgrade (constructor-set state + attribute/connected reactions) and the `#private`-field
  regression (#1593), both registered through `register()` and asserting no global is touched.

FUI gate: `check:standards` 0 errors; full `vitest run` 385 files / 4262 tests passed (incl. the 10 new
cases). No WE-side code change (WE holds zero implementation, #1282) — this item's own backlog file only.
graduatedTo: none (test-only proof, no new FUI runtime surface). Locus: FUI.
