---
kind: story
size: 3
parent: "1391"
status: open
locus: plateau-app
blockedBy: ["1753"]
humanGate: { kind: setup, short: "Boot-verify the takeover screen from a session with a real display.", what: "Everything below is headless-authorable and vitest-testable except the final step: launching the shell (per #1753's own launch script) against a known-non-conformant target and a known-conformant one, and confirming visually that the takeover fills the content-pane area for the former and the target page renders normally for the latter. Mirrors #1753's own humanGate shape exactly — same launch mechanism, same one un-automatable step." }
dateOpened: "2026-06-24"
tags: []
---

# Dev-browser shell — navigation interception + "not WE-compatible" takeover screen

Intercept top-level navigation in the shell and, when the on-load conformance probe (S1/#1753) reports a
non-conformant target, render the full-screen "this site isn't Web Everything-compatible" takeover (#141: a
chrome-level capability an extension can't reach — see #141's own line: *"Navigating to a random/incompatible
website simply reports 'this site isn't Web Everything-compatible' — you could browse it, but there's no
value."*). Home `plateau:packages/dev-browser/src/shell/` (corrected from the card's original
`plateau:src/dev-browser/shell/` — see Scope correction). Demoable: navigating to a non-WE URL shows the
takeover filling the content-pane area; a conformant app loads normally there instead.

## Scope correction (verified against the tree, 2026-08-15)

The original card's home path (`plateau:src/dev-browser/shell/`) is stale. `plateau:src/dev-browser/` does
not exist on `main` (checked: a `find` for that directory in the plateau-app tree returns nothing) — #2342
moved the dev-browser to its own package, and #1753's 2026-08-15 re-preparation homed the shell at
`plateau:packages/dev-browser/src/shell/`. This card follows suit. That directory also does not exist yet on
`main` — **#1753 has not landed**, only been re-prepared (its PR #1309 is doc-only, same as this one). This is
a hard sequencing dependency, not just bookkeeping: every interface below extends files #1753's own card
specifies but that don't exist in the tree yet. A build session cannot open a type-checking PR for this item
until #1753's shell scaffold actually merges. See Delivery shape.

## Decided design

This slice extends, and does not re-derive, #1753's already-decided shell architecture (two `WebContentsView`s
— a status pane docked top, 32px, and a content pane filling the rest — wired by a pure `computeLayout`
function, with the content pane's preload calling `detect()` and relaying the `ProbeResult` through main to
the status pane over one IPC channel, `PROBE_RESULT_CHANNEL`). #1753's own design text names this slice
directly: *"S2's full-screen takeover (#1754) ... need[s] a chrome surface to render into"* — i.e. the
takeover is rendered through the same trusted-chrome-view mechanism the status pane already establishes, not
a new UI system.

**1. A third, normally-detached `WebContentsView` — "takeover" — occupies the content pane's exact slot when
shown; nothing new is added to the window's layout.** `plateau:packages/dev-browser/src/shell/layout.ts`'s
existing `computeLayout`'s `contentBounds` result is reused verbatim as the takeover view's bounds — no
change to that module. "Full-screen" here means *fills the content-pane area* (the loaded-app's viewport),
not the whole OS window: the status bar stays visible and unaffected, continuing to show whatever text #1753
already produces for the same probe result (e.g. "No Web Everything detected"). This reading is the one
#1753's own text supports (a *chrome surface*, i.e. the same kind of trusted view as the status pane — not a
literal full-window replacement) and keeps the two slices' demoable states independently checkable: the
status bar's wording is S1's contract, the content-pane swap is this item's.

**2. Swap mechanism: `removeChildView` / `addChildView` on the window's `contentView`, not a visibility
toggle.** Electron's `WebContentsView` (and its `BaseWindow.contentView` parent) has no `setVisible`; the
established pattern is to detach the view that should be hidden and attach the one that should show, at the
same bounds. Exactly one of {content pane, takeover} is attached at a time; the other's `webContents` keeps
running in the background (not destroyed), matching how #1753's status pane is expected to keep running
throughout the shell's life.

**3. Trigger mechanism: `did-navigate` on the content pane's `webContents`, not `will-navigate`.** Verified
against the installed `electron@38.8.6` type definitions
(`plateau:packages/dev-browser/node_modules/electron/electron.d.ts:16687-16699` for the `will-navigate` doc
comment; the `did-navigate` doc comment sits a few hundred lines earlier in the same file, immediately above
its `on(event: 'did-navigate', ...)` overloads): **`will-navigate` explicitly does not fire for navigations
started programmatically via `webContents.loadURL`** ("This event will not emit when the navigation is
started programmatically with APIs like `webContents.loadURL`") — which is exactly how #1753's shell main
entry loads the initial target URL (its `createShellWindow`'s own `loadURL(targetUrl)` call, in
`plateau:packages/dev-browser/src/shell/main.ts`). Wiring on `will-navigate` would silently miss the very
first navigation the shell performs. `did-navigate` ("Emitted when a main frame navigation is done... not
emitted for in-page navigations") fires for **every** main-frame navigation regardless of how it was
triggered, and explicitly excludes hash/anchor in-page navigation (`did-navigate-in-page`) — which is the
right exclusion here too, since an SPA route change without a real reload won't re-fire the content preload's
`load` listener either, so re-probing on it would be a no-op anyway. This de-risks the one part of this design
that could be wrong in a way that only shows up late (checklist item 8): a `will-navigate`-based design would
build clean, pass a manual "click a link" check, and then silently never fire on the shell's own initial load
— exactly the failure mode a POC is supposed to catch before the build, not during it.

**4. State is driven by a pure reducer, matching #1753's own bias toward headless-testable logic.** Two event
sources feed one state machine: a `did-navigate` firing on the content pane (a new top-level navigation is
underway — optimistically show the content pane again, clearing any stale takeover from the previous page
while the new page's probe result is pending), and a `PROBE_RESULT_CHANNEL` message arriving in main (the new
page's probe finished — show takeover iff `!result.conformant`). The reducer itself has no Electron
dependency and is fully vitest-testable; only the "apply the state to actual views" glue in the shell's main
entry is not (same non-testable status #1753 itself accepted for its own main entry, task 6).

**5. No new IPC channel.** The takeover view's preload subscribes to the exact same `PROBE_RESULT_CHANNEL`
`plateau:packages/dev-browser/src/shell/ipc.ts` already defines, and forwards through main to the status pane;
this item's only change to that relay is forwarding the same message to a second destination (the takeover
view, when it exists) — #1753's own IPC design text anticipated this: *"Routing through main ... is also what
lets S2 later branch shell behavior (takeover screen) on the same event without re-plumbing."*

**6. Takeover copy is static, no target URL interpolation, and follows #1753's "never overclaim" wording
rule.** The screen shows fixed copy — *"This site isn't Web Everything-compatible."* (the literal #141
phrasing) — with no dynamic content and no use of the word "conformant" (mirrors #1753 point 5's rule,
enforced there by a test asserting the status label never says "conformant"; this item's takeover-page test
asserts the same discipline on its own copy). **Explicitly out of scope for this slice:** a "browse anyway"
dismiss action. #141's vision prose ("you could browse it, but there's no value") gestures at one existing
someday, but this card's own text only asks for the takeover to render — it does not ask for a way past it,
and neither #1753 nor the shell has any address-bar / user-driven-navigation UI yet for "browse anyway" to
navigate *from*. Naming this explicitly (not silently building or silently omitting) so a builder doesn't
guess: if a dismiss affordance turns out to be wanted, it is a follow-up card once there is an actual
navigation UI to escape into.

## Interfaces / protocol

All new files live under `plateau:packages/dev-browser/src/shell/` unless noted. Cites #1753's own Interfaces
section (its shell main entry, its layout module, its IPC-contract module, its status-pane preload and
status-render script — all under that same directory) as ground truth for what already exists once #1753
lands — this item only adds to it.

- Pure state module — `plateau:packages/dev-browser/src/shell/chrome/navigation-state.ts` (pure,
  headless-testable, zero Electron import):
  ```ts
  import type { ProbeResult } from '@plateau/core';

  export type ChromeSlot = 'content' | 'takeover';

  export type ChromeStateEvent =
    | { type: 'navigated' }
    | { type: 'probe-result'; result: ProbeResult };

  export function nextChromeSlot(current: ChromeSlot, event: ChromeStateEvent): ChromeSlot;
  // 'navigated'      -> always 'content' (optimistic reset; clears a stale takeover while the new
  //                      page's probe result is pending)
  // 'probe-result'    -> event.result.conformant ? 'content' : 'takeover'
  ```
- Takeover page, mirroring the status page's own (provisionally-named, per #1753's card) three-file shape:
  - `plateau:packages/dev-browser/src/shell/chrome/takeover.html` — the small local page the shell ships and
    controls (same trust level as #1753's status page).
  - `plateau:packages/dev-browser/src/shell/chrome/takeover-preload.ts` —
    `contextBridge.exposeInMainWorld('weShellTakeover', { onProbeResult(cb) { ipcRenderer.on(
    PROBE_RESULT_CHANNEL, (_e, r) => cb(r)); } })` — imports the existing `PROBE_RESULT_CHANNEL` constant from
    the IPC-contract module unchanged, no new export needed there.
  - `plateau:packages/dev-browser/src/shell/chrome/takeover.ts` — exports a pure `applyTakeover(el:
    HTMLElement, result: ProbeResult | null): void` DOM update (renders the fixed copy; a `null`/conformant
    result is a no-op state the view is never shown in, but the function stays total rather than assuming),
    same test shape as #1753's own status-render script and its
    `plateau:packages/extensions/src/chrome-extension/panel-detect.test.ts` precedent. Wired at module top
    level via `window.weShellTakeover.onProbeResult((r) => applyTakeover(takeoverEl, r))`.
- `plateau:packages/dev-browser/src/shell/main.ts` additions (extends #1753's `createShellWindow`, no new
  exported function):
  - Create a third `WebContentsView` (`takeoverView`), same trusted `webPreferences` shape as the status
    view, loading the takeover HTML page above. Created once at window-create time; **not** attached to
    `win.contentView` initially (start state = `'content'`).
  - Track `let activeSlot: ChromeSlot = 'content'` and an `applySlot(next: ChromeSlot)` helper: no-op if
    `next === activeSlot`; otherwise `win.contentView.removeChildView(<the one hiding>)`, `setBounds` on the
    one showing to the current `computeLayout(...).contentBounds`, `win.contentView.addChildView(<the one
    showing>)`, update `activeSlot`.
  - `contentView.webContents.on('did-navigate', () => applySlot(nextChromeSlot(activeSlot, { type:
    'navigated' })))`.
  - Extend the existing `ipcMain.on(PROBE_RESULT_CHANNEL, ...)` handler: keep forwarding to
    `statusView.webContents.send(...)` (#1753, unchanged) and **add** `takeoverView.webContents.send(...)`
    (harmless to send to a currently-detached view — its `webContents` is alive whether or not it's attached
    to the window), then call `applySlot(nextChromeSlot(activeSlot, { type: 'probe-result', result })))`.
  - Extend the existing window `resize` handler to also reposition whichever of {content pane, takeover} is
    the current `activeSlot`'s view, using the same recomputed `contentBounds` #1753 already recomputes for
    the content/status panes on resize.

## Tasks (ordered)

1. Once #1753 has landed: confirm its actual file names/paths for the status page's HTML/preload/script match
   what's cited above (its own card didn't pin the status page's exact HTML filename) — adjust the takeover
   page's filenames to mirror whatever convention S1's build actually used, not this card's provisional guess.
2. Write `plateau:packages/dev-browser/src/shell/chrome/navigation-state.ts` plus its vitest suite (both event
   types, both starting slots — 4 transition cases minimum).
3. Write the takeover page — `plateau:packages/dev-browser/src/shell/chrome/takeover.html`,
   `plateau:packages/dev-browser/src/shell/chrome/takeover-preload.ts`, and
   `plateau:packages/dev-browser/src/shell/chrome/takeover.ts` — plus a vitest suite mirroring
   `plateau:packages/extensions/src/chrome-extension/panel-detect.test.ts`'s pattern: assert the rendered
   copy never contains "conformant", and asserts the exact fixed string is rendered regardless of the passed
   `ProbeResult`'s `level`.
4. Extend `plateau:packages/dev-browser/src/shell/main.ts`: create `takeoverView`, wire the `did-navigate`
   listener, extend the `PROBE_RESULT_CHANNEL` handler to forward to `takeoverView` and drive `applySlot`,
   extend the resize handler. Not vitest-testable (no Electron runtime in the test environment), same as
   #1753's own main-entry task.
5. Run the full plateau-app test suite and confirm it is green (this item's two new suites, plus no
   regressions to #1753's suites).
6. Hand off / self-verify (needs a display, per this card's `humanGate`): using #1753's launch script, load a
   known-conformant target (content pane shows the app normally, no takeover) and a known-non-conformant one
   (takeover fills the content-pane area, status bar still reads "No Web Everything detected"). If time
   allows, also manually verify the interception isn't a one-shot: from the non-conformant state, point the
   shell at a conformant target (re-run the launch script with a different target URL) and confirm the
   takeover clears and the app loads — proving the mechanism reacts to more than just the very first load.

## Done when

- [ ] The full plateau-app test suite is green, including the two new suites from tasks 2–3.
- [ ] Loading a known-non-conformant target shows a takeover filling the content-pane area with copy that
      never contains the word "conformant"; the underlying non-conformant page is never visible.
- [ ] Loading a known-conformant target shows the target page normally in the content pane; no takeover view
      is attached.
- [ ] Window resize keeps whichever of {content pane, takeover} is currently shown filling the exact
      `contentBounds` rectangle #1753's layout module computes (no gap/overlap), matching #1753's own resize
      contract.
- [ ] (From a display session) the status bar's text (#1753's own contract) and the content-pane takeover
      state agree with each other for the same probe result — they are driven by the same message, never
      shown to disagree.

## Delivery shape

Single PR, lands directly on `main` — no flag needed, same reasoning as #1753: everything this item touches
is either net-new (the takeover page, the state module) or an addition to
`plateau:packages/dev-browser/src/shell/main.ts`, which nothing in the existing app imports or auto-runs
(confirm this against #1753's actual landed main entry at build time — it wasn't in the tree to grep during
this preparation). It only becomes reachable by a developer explicitly running the launch script #1753 adds.

**Hard sequencing note:** this PR cannot be authored, typechecked, or opened until #1753's shell scaffold has
actually merged to `main` (not merely been re-prepared) — every file this item extends (the shell's main
entry, its layout module, its IPC-contract module, the status page's preload and script, all under
`plateau:packages/dev-browser/src/shell/`) is specified by #1753's card but does not exist in the tree yet.
`blockedBy: ["1753"]` already encodes this in the backlog graph; stated here so a builder doesn't attempt to
scaffold around the missing files.
