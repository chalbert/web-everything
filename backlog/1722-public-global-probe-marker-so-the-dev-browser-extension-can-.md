---
kind: task
status: resolved
locus: frontierui
parent: "1656"
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1656
tags: [dev-browser, conformance, chrome-extension, webregistries]
---

# Public global probe-marker so the dev-browser extension can detect WE on non-declarative pages

Today an extension content-script (isolated world) can only probe the declarative `script[type="registry"]` DOM marker; the richer runtime signals (`SCOPED_REGISTRY_KEY` is a module-private `Symbol()`, `getActiveRegistryResult()` is closure state) are unreadable cross-boundary, so imperatively-scoped-registry / injector-chain / webexpressions-only apps are probe-invisible. Expose a public, cross-world-readable global marker (the move React/Vue made with `__REACT_DEVTOOLS_GLOBAL_HOOK__`) that mirrors WE runtime presence, so probe-first (#1673) widens from the declarative minority to any live WE page. Load-bearing follow-up promoted by #1673's ratification red-team.

## Progress (batch-2026-06-23-1725-1665)

**Locus corrected webeverything → frontierui.** The runtime signals this exposes (`SCOPED_REGISTRY_KEY`, `getActiveRegistryResult`, plugged-mode patching) all live in `fui:plugs/webregistries/`; a public runtime devtools hook is impl, so it homes in FUI (constellation-placement; WE holds zero impl).

Built the public cross-world marker `window.__WE_DEVTOOLS_GLOBAL_HOOK__` (the `__REACT_DEVTOOLS_GLOBAL_HOOK__` move) in `fui:plugs/webregistries/declarativeRegistry.ts`:

- `markWebEverythingActive(feature, resultReader?)` installs the hook idempotently on `globalThis` and records the activated surface; `getDevtoolsHook()` / `WE_DEVTOOLS_GLOBAL_HOOK` / `WebEverythingDevtoolsHook` exported (re-exported from `fui:plugs/webregistries/index.ts`). The hook is read-only from the probe's POV: `version` (gate), `runtime`, `features` set, `present`, and `getActiveRegistryResult()` (live snapshot).
- Wired at every activation point the declarative DOM probe can't see: `applyDeclarativeRegistries` (→ `declarative-registry`, with the live result reader), `applyScopedRegistryToHost` (→ `scoped-registry`, the imperative path), `applyPatches` (→ `plugged-mode`). So probe-first (#1673) widens from the declarative minority to any live WE page.
- Co-located in declarativeRegistry rather than a standalone module on purpose: a new leaf module shifted happy-dom's eval order and perturbed the plugged-mode tests; homing it in a module the runtime already imports keeps the graph shape unchanged.
- New `fui:plugs/webregistries/__tests__/unit/devtoolsHook.test.ts` (6 tests). Also corrected a **stale assertion** in `fui:plugs/webregistries/__tests__/unit/globalPatching.test.ts` that asserted `window.customElements` is swapped to the scoped class — but applyPatches step 3 is DISABLED (#1387/#1545: root swap white-pages the site), so the root registry stays native; the old `toBeInstanceOf` only passed via a happy-dom instanceof quirk. Now asserts the real behavior. Full webregistries suite green (70 tests); FUI check:standards 0 errors.

The extension-side MAIN-world bridge that reads the hook is the extension's concern (#1673 / dev-browser), not this slice.
