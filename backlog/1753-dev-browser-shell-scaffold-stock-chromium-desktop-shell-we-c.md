---
kind: epic
parent: "1391"
status: open
locus: plateau-app
humanGate: { kind: setup, short: "Boot-verify the Electron shell window from a session with a real display; everything else in this slice is headless-authorable and vitest-testable.", what: "Narrowed during prep (2026-08-15) — the prior humanGate's two blockers are both stale. (1) 'Electron is NOT a plateau-app dependency (~100MB native add)' is FALSE now: #2342 (resolved 2026-07-09) added Electron ^38.8.6 as a dependency of plateau:packages/dev-browser/package.json ONLY, exactly to dissolve this objection. The Electron.app binary is already fetched into that package's node_modules on this machine. (2) 'The pure conformance-probe parsing could be carved as a headless-testable sub-slice' — ALREADY DONE: #2211 (resolved 2026-07-03, child of this item) built and fully unit-tested the plateau:packages/core/src/probe/detect.ts function (`detect(doc, win) -> ProbeResult`, 9 vitest cases, zero Electron dependency), explicitly 'for the dev-browser shell to import' (per plateau:packages/core/src/probe/index.ts's own header comment). What remains for #1753 is wiring only — a BrowserWindow + two WebContentsViews, a preload that calls the already-built detect() and IPCs the result, and a status-bar UI — and per the design below, the layout math, the IPC contract, and the status-render function are all pure and headless-testable (mirroring the precedent at plateau:packages/extensions/src/chrome-extension/panel-detect.test.ts and plateau:vitest.config.ts's own note on tests/fidelity/: 'the BROWSER run ... is the self-proving CLI acceptance, not a vitest spec'). Only the final step — actually launching the shell and confirming a native window appears with the right status text for a conformant vs non-conformant target — needs a session with a display. A build session should write and vitest-green everything else first, then hand off (or self-verify if it has a display) for that one step." }
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
tags: []
---

# Dev-browser shell scaffold — stock-Chromium desktop shell + WE-conformance probe on load

Stand up the Electron desktop shell under plateau:packages/dev-browser/src/shell/ — boots a `BrowserWindow`, loads a target URL into a content pane, and reports WE-conformance via the already-built headless probe (plateau:packages/core/src/probe/detect.ts, #2211) on load. Foundational slice of #1391: demoable state = shell boots and reports conformant vs non-conformant for the loaded app.

## Scope correction (verified against the tree, 2026-08-15)

The original card assumed a ~100MB Electron dependency objection and treated probe-parsing as a maybe-later carve-out. Both are settled: **#2342** scoped Electron to the dev-browser package alone (an `"electron": "^38.8.6"` entry in plateau:packages/dev-browser/package.json), and **#2211** already shipped the headless detect function this shell imports. Remaining scope is pure wiring — no new detection logic, no dependency fight. The card's original `size: 5` assumed the probe-detection work was still ahead of it; #2211 already carved that out as a resolved child of this item, so per repo convention (a sized story that also has children double-counts the burndown) this card now carries no `size` of its own — read its remaining scope as comparable in shape to #2211 (a self-contained module + tests) with more moving parts (two Electron view types, an IPC hop, a small build script) offset by zero design-research (the mechanism is fully decided below).

One more verified correction: the card's own text says "BrowserView" — checked against the type definitions the installed `electron@38.8.6` package ships (under plateau:packages/dev-browser/node_modules/), `BrowserView` and the `BrowserWindow` methods that accept one are marked deprecated, replaced by `WebContentsView` attached via a window's `contentView.addChildView()`. The design below uses `WebContentsView`, not `BrowserView`.

## Decided design

**1. Two-pane window, not a title-bar hack.** A `BrowserWindow` (chrome host) with two `WebContentsView`s attached via its `contentView.addChildView(view)`:
   - a status pane docked at the top (default 32px height), loading a small local status page the shell ships and controls, always trusted;
   - a content pane below it, filling the rest of the window, showing the loaded target app.
   Both are laid out by a pure function and re-laid-out on window resize (see Interfaces). This isn't gold-plating: #1654 (resolved) already ruled the dev-browser's shape as "privileged chrome docked beside" the loaded page, not an iframe — S2's full-screen takeover (#1754) and S3's feature lighting (#1755) both need a chrome surface to render into, so building a title-bar-only status for S1 would just get ripped out one slice later. The content pane keeps Electron's secure defaults (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`) — it may load an arbitrary third-party URL per #1654's "yours or an arbitrary external URL," so it must never get Node/main-world privilege.

**2. Probe wiring: the content pane's preload calls detect() directly on the real DOM, no eval-string duplication.** The Chrome-extension MVP (#1673/#2210, plateau:packages/extensions/src/chrome-extension/panel-detect.js) had to duplicate the probe as an inline JS-string because `chrome.devtools.inspectedWindow.eval()` can only return JSON, not a live object — content-script isolation there is document-only. Electron's preload scripts are different: even under `contextIsolation: true`, a preload attached to a view runs in the same renderer process and shares the real `document`/`window` DOM objects with the page it's attached to (isolated worlds share the DOM; they only get separate JS-builtin realms) — exactly the boundary `window.__WE_DEVTOOLS_GLOBAL_HOOK__` was built to cross (#1722: "a public, cross-world-readable global marker"). So the content pane's preload can import `detect` from `@plateau/core` and call it directly on the real `document`/`window`, no string-eval duplication, no JSON-only round-trip. This is a stronger position than the extension's, not a smaller one — cite it, don't re-derive it, if a future slice asks why the two probes look different.

**3. IPC is a three-hop relay, not a shortcut.** Electron has no renderer-to-renderer channel; each pane's preload only talks to the main process. Protocol (one channel, one direction): the content pane's preload sends the probe result to main over IPC; main forwards it to the status pane's `webContents` over IPC; the status pane's preload receives it and exposes it to its page script via `contextBridge`, which updates the status DOM. Routing through main (rather than trying to shortcut renderer-to-renderer) is required by the platform, and it's also what lets S2 (#1754) later branch shell behavior (takeover screen) on the same event without re-plumbing.

**4. Trigger point: the content page's `load` event.** Matches the card's "probes WE-conformance on load." A page that installs `window.__WE_DEVTOOLS_GLOBAL_HOOK__` asynchronously after `load` will under-report at the initial probe (falls back to a lower level or none) — an accepted limitation for this slice, not a bug to chase; a live re-probe is a natural, separable follow-up if it turns out to matter.

**5. Status text must not overclaim.** The probe's level enum (none / declarative / runtime / full, defined alongside detect in plateau:packages/core/src/probe/types.ts) is presence/level, not a verified conformance claim — per the ratified #1673 Fork 2 ("tiers escalate the assertion... probe ⇒ 'Web Everything detected' (presence), never a 'WE-conformant' claim"), already enforced by a test in the extension precedent (plateau:packages/extensions/src/chrome-extension/panel-detect.test.ts asserts the label 'does NOT use the word "conformant"'). The shell's status text must follow the same rule — e.g. "Web Everything detected (full)" / "No Web Everything detected", never "conformant".

**6. Do not conflate two different level enums that share a name.** The probe's level type (none/declarative/runtime/full, probe-tier) and the `@webeverything/capability-manifest` package's differently-scoped level type (L0/L1/L2, used by plateau:packages/dev-browser/src/feature-lighting/light.ts for S3/#1755's declared-manifest gate) share the name `ConformanceLevel` but are different vocabularies from different tiers (#1673 Fork 1: PROBE vs DECLARED). This shell (S1) only ever produces/consumes the probe one. Flagging so S3's builder doesn't wire the wrong type through.

**7. Build/launch: esbuild, no new toolchain.** No package here has a build step yet; `esbuild` is already resolvable (transitive via `vite`, its binary already present at the workspace root's installed-binaries directory) — matches #2346's "no new toolchain" ethos. Add a small build script under plateau:packages/dev-browser/scripts/ that bundles the shell's main entry plus its two preload scripts to a `dist/shell/` output, and a workspace-root launch script that builds then runs Electron against the built main entry. **Open verification task, not a silent assumption:** confirm CommonJS is right for both preload outputs against the installed `electron@38.8.6` — Electron supports ESM main-process code since v28 when its package manifest sets `"type": "module"` (already true here), but sandboxed preload scripts have historically required CommonJS in some Electron configurations. Check this against the installed version's docs before finalizing the esbuild output format; default to CommonJS for the preload outputs if an ESM preload throws at load time. Module resolution itself needs no custom esbuild alias: the dev-browser package already depends on `@plateau/core` as a real npm-workspaces dependency (symlinked under the workspace root's installed-packages directory), and that package's declared entry point already barrels the probe module (per plateau:packages/core/src/index.ts's own `export * from './probe';` line) — so a bare `import { detect, type ProbeResult } from '@plateau/core'` (no subpath) resolves with zero extra config.

## Interfaces / protocol

All new files live under plateau:packages/dev-browser/src/shell/ unless noted. Filenames below are relative to that directory.

- Layout module (plateau:packages/dev-browser/src/shell/layout.ts, pure, headless-testable):
  ```ts
  export interface Rectangle { x: number; y: number; width: number; height: number }
  export function computeLayout(windowBounds: Rectangle, chromeHeightPx?: number /* default 32 */):
    { chromeBounds: Rectangle; contentBounds: Rectangle }
  ```
- IPC contract module (plateau:packages/dev-browser/src/shell/ipc.ts), the shared constant main and both preloads import:
  ```ts
  export const PROBE_RESULT_CHANNEL = 'we:probe-result' as const;
  // payload type = ProbeResult, re-exported from '@plateau/core'
  ```
- Content-pane preload (plateau:packages/dev-browser/src/shell/probe-preload.ts), attached to the content view's `webPreferences.preload`. On `window.addEventListener('load', ...)`: calls `detect(document, window as Window & Record<PropertyKey, unknown>)`, then `ipcRenderer.send(PROBE_RESULT_CHANNEL, result)`.
- Status-pane preload (plateau:packages/dev-browser/src/shell/chrome/chrome-preload.ts), attached to the status view's preload: `contextBridge.exposeInMainWorld('weShell', { onProbeResult(cb) { ipcRenderer.on(PROBE_RESULT_CHANNEL, (_e, r) => cb(r)); } })`.
- Status-pane script (plateau:packages/dev-browser/src/shell/chrome/chrome.ts), runs inside the status page: exports a pure `applyStatus(el: HTMLElement, result: ProbeResult | null): void` DOM update, same shape as the extension's status-render helper, testable the same way (mirrors plateau:packages/extensions/src/chrome-extension/panel-detect.test.ts's pattern). Wired at module top level via `window.weShell.onProbeResult((r) => applyStatus(statusEl, r))`.
- Main entry (plateau:packages/dev-browser/src/shell/main.ts): exports `createShellWindow(targetUrl: string): BrowserWindow`. Creates the `BrowserWindow`, both `WebContentsView`s, wires each view's bounds via the layout module on create and on the window's `resize` event, registers the main-process IPC listener that forwards a received probe result to the status view's `webContents`, and loads `targetUrl` into the content view. Reads the target URL from an environment variable (default `http://localhost:4000`, plateau-app's own dev server), with the standard Electron `app.whenReady()` / `window-all-closed` / `activate` lifecycle handlers.
- Build script under plateau:packages/dev-browser/scripts/ (a plain `.mjs`, run via `node`, mirroring the existing generator-script convention at the workspace root): calls esbuild's `build()` API to bundle the main entry and both preload scripts into the `dist/shell/` output.
- The workspace-root manifest (plateau:package.json): add a launch script that runs the build script above, then runs Electron against its output.

## Tasks (ordered)

1. Verify CommonJS-vs-ESM preload support against the installed `electron@38.8.6` (open item 7 above); pick the esbuild output format.
2. Write the IPC contract module (channel constant).
3. Write the layout module plus its vitest suite (pure, no Electron).
4. Write the content-pane preload plus its vitest suite (mock `ipcRenderer`/`document`/`window`, same happy-dom pattern as the existing plateau:packages/core/src/probe/probe.test.ts suite; assert it calls detect and sends on the right channel — no Electron boot needed).
5. Write the status page (HTML + preload + script) plus a vitest suite mirroring plateau:packages/extensions/src/chrome-extension/panel-detect.test.ts.
6. Write the main entry — window/view bootstrap (not vitest-testable; no Electron runtime in the test environment).
7. Write the build script plus the workspace-root launch script.
8. Run the full plateau-app test suite and confirm it is green (new suites + no regressions).
9. Hand off / self-verify (if the session has a display): run the launch script, confirm the window boots, and confirm the status pane text differs between a known-conformant target and a known-non-conformant one. **The specific fixture URLs are not pinned here** — a grep of the HTML demo files under we:demos/ turned up no static registry-script markup (it's runtime-installed, not static), so pick and eye-check a live conformant URL during the build (open its devtools console, confirm the devtools hook global is defined or a registry script exists in the live DOM) rather than trusting an unverified guess here.

## Done when

- [ ] The full plateau-app test suite is green, including the three new suites from tasks 3–5 above.
- [ ] The build script from task 7 completes with no errors and produces a runnable Electron main entry.
- [ ] The launch script (from a session with a display) boots a native window with no crash.
- [ ] Loading a known-conformant target shows a status string containing "detected" (never "conformant") at the correct level; loading a known-non-conformant target shows "No Web Everything detected".
- [ ] Resizing the window keeps the status pane pinned at its configured height and the content pane filling the remainder (no gap/overlap) — verified either visually or via a layout-module test case at a couple of window sizes.

## Delivery shape

Single PR, lands directly on `main` — no flag needed. Everything under the new shell directory and the new launch script is net-new and additive: nothing in the existing app imports or auto-runs it, so there is no risk surface to gate behind a flag. It only becomes reachable by a developer explicitly running the new launch script.
