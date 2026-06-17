---
type: decision
workItem: story
size: 3
parent: "777"
status: open
dateOpened: "2026-06-17"
tags: []
---

# Decide the WE→FUI mode-C host-config transport for dogfooded chrome

The mode-C in-document mount SDK (#786) calls a FUI-hosted module's mountInDocument(root: ShadowRoot) with ONLY the shadow root — no channel for host config. The dogfooded WE-docs chrome (#865) needs WE to supply its nav tree / brand / footer (WE-owned content) to FUI-rendered components (#870's app-shell/sectioned-nav/button, which expose mount*(root, config) factories). The constellation boundary forbids baking WE's information architecture into a FUI module. Decide the config-transport convention across the WE↔FUI mode-C boundary — a cross-repo convention reusable by every mode-C host, not just chrome. Gates #865.

## Why this is a decision, not a build

Surfaced mid-batch (batch-2026-06-17) while working #865. The pre-flight skim saw only #865's stale re-block on #870 (the must-build blocks, now resolved); this fork sits one layer below it. Verified against the real trees:

- The mode-C host (`frontierui/embed/in-document.ts:mountInDocumentPoint`) does `mod.mountInDocument(root)` — `root` is the `ShadowRoot`; the only host-reachable handle is `root.host` (the mount-point element). **No config argument exists.**
- The only existing mode-C module (`frontierui/demos/embed-dialog-in-document.ts`) is **self-contained** — it renders fixed content, takes no host input. No precedent for host→module config.
- #870 deliberately shipped the chrome blocks with **both** `mountInDocument(root)` (self-contained) **and** a `mount*(root, config)` factory, noting *"the config factory … for #865 to pass WE-docs-specific brand/nav/buttons"* — i.e. it left the *transport* of that config undecided.
- The #778 inventory (plan of record) maps which block covers which surface but is **silent on transport**.

WE owns the nav/brand/footer (site information architecture = content); FUI owns the components (rendering). The constellation docs-rendering boundary (#765's WE↔FUI-pair relaxation; WE never imports/renders FUI code, it only mounts it) forbids FUI owning WE's IA. So the config must cross WE→FUI at mount time, and **how** is an undecided, reusable cross-repo convention — every future mode-C host that needs host-specific config inherits it. Picking it silently would be a quiet design call; filed as a decision instead (design forks are work items, not in-flight calls).

## Forks

### Fork 1 — the transport channel (the core call)

- **A (bold default) — host writes config as data on the mount point; a generic FUI module reads `root.host` and renders via the #870 factories.** WE emits `<div data-embed-mode="in-document" data-embed-src="…/chrome/app-shell.js" data-chrome-config='{…json…}'>`; the generic FUI module reads/parses `root.host.dataset.chromeConfig` and calls `mountAppShell(root, config)`. *Boundary-clean (WE owns content, FUI owns rendering), reuses #870's factories as-is, no contract change, generalizes to any mode-C host config, degrades gracefully (no/invalid config → the block's self-contained default).* Residual: JSON-in-attribute ergonomics for a deep nav tree (acceptable for chrome-sized config; promote to B if it ever grows unwieldy).
- **B — extend the ratified mode-C contract so `mountInDocument(root, hostConfig?)` receives config the SDK lifts off the mount point.** Config becomes a first-class, typed argument (no dataset-scraping). Cost: changes the #786 `EmbedMountModule` contract + the host SDK signature + the existing demo — touches every mode-C consumer for a need only the chrome has today.
- **C — a WE-docs-specific chrome module hosted in FUI (nav baked in).** Simplest build, but couples FUI to WE's IA (a WE nav change edits FUI) — **rejected on the constellation boundary**, recorded only to show it was considered.
- **D — WE sets a global (`window.__weChromeConfig`) the generic FUI module reads at boot.** Works, but global-state + load-ordering coupling; strictly worse than A's per-mount-point locality.

Recommendation: **A**, confidence **~80%**. The residual is purely ergonomic (deep config in a string attribute); A keeps the #786 contract untouched and is the most-flexible/lowest-coupling option, and B remains a clean later promotion if config outgrows an attribute.

### Fork 2 — mount granularity (secondary; resolve with Fork 1)

One mount point for the whole shell (`app-shell.js` composes nav + buttons internally from one config blob) **(bold default — A)**, vs. one mount point per region (separate header / nav / footer / button mounts). A is simpler for the host (one `{% raw %}{% fuiChrome %}{% endraw %}` emission, one config), matches `app-shell` being the composing block, and keeps the skip-link/landmark order correct in one place. Per-region only earns its keep if regions need independent lifecycles — not the case for static chrome. Confidence **~75%**; residual is whether the footer wants to mount independently of the header (cheap to split later).

### Out of scope (follow-on build, this card only decides)

Progressive-enhancement fallback for no-JS / pre-mount (the hand-written `base.njk` chrome must remain the SSR baseline so the page is navigable before/without the mount) is an implementation concern of #865, constrained by — not decided by — this fork.
