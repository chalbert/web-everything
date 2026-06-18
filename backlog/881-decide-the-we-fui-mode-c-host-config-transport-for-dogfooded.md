---
type: decision
workItem: story
size: 3
parent: "777"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#we-fui-embed-boundary
relatedProject: webdocs
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-18"
preparedDate: "2026-06-17"
relatedReport: reports/2026-06-17-881-mode-c-host-config-transport.md
tags: [webdocs, dogfooding, mode-c, embed, config-transport]
---

# Decide the WE→FUI mode-C host-config transport for dogfooded chrome

The mode-C in-document mount SDK (#786) calls a FUI-hosted module's `mountInDocument(root: ShadowRoot)` with ONLY the shadow root — no channel for host config. The dogfooded WE-docs chrome (#865) needs WE to supply its nav tree / brand / footer (WE-owned content) to FUI-rendered components (#870's app-shell/sectioned-nav/button, which expose `mount*(root, config)` factories). The constellation boundary forbids baking WE's information architecture into a FUI module. Decide the config-transport convention across the WE↔FUI mode-C boundary — a cross-repo convention reusable by every mode-C host, not just chrome. Gates #865.

## Grounding digest

Verified against the real trees (2026-06-17); full survey in [`we:reports/2026-06-17-881-mode-c-host-config-transport.md`](../reports/2026-06-17-881-mode-c-host-config-transport.md), research topic [`mode-c-host-config-transport`](/research/mode-c-host-config-transport/).

- **The SDK passes only the shadow root.** [`fui:frontierui/embed/in-document.ts:89`](../../frontierui/embed/in-document.ts) does `mod.mountInDocument(root)`; the contract [`fui:frontierui/embed/contract.ts:72-74`](../../frontierui/embed/contract.ts) declares `mountInDocument(root: ShadowRoot): void | (() => void)`. The only host-reachable handle inside the module is `root.host` (the mount-point element). **No config argument exists.**
- **The mount point is configured purely by `data-*` today.** The SDK selects points by `data-embed-mode="in-document"` and loads them from `data-embed-src` ([`fui:in-document.ts:26-27,65,97-98`](../../frontierui/embed/in-document.ts)) — already a dataset-driven convention.
- **The only existing mode-C module is self-contained.** [`fui:frontierui/demos/embed-dialog-in-document.ts:26`](../../frontierui/demos/embed-dialog-in-document.ts) renders fixed content, takes no host input. No precedent for host→module config.
- **#870 shipped each chrome block with both APIs.** `mountInDocument(root)` (self-contained) **and** a `mount*(root, config)` factory: [`fui:AppShell.ts:144,156`](../../frontierui/blocks/app-shell/AppShell.ts), [`fui:SectionedNav.ts:120,132`](../../frontierui/blocks/sectioned-nav/SectionedNav.ts), [`fui:Button.ts:119,130`](../../frontierui/blocks/button/Button.ts) — i.e. it left the *transport* of that config undecided.
- **Load-bearing wrinkle — `AppShellConfig` holds live `Node`s, not data.** `nav?: Node`, `footer?: Node`, `headerControls?: Node[]` ([`fui:AppShell.ts:29-43`](../../frontierui/blocks/app-shell/AppShell.ts)). Because mode C has no host→module JS handoff point, any transport riding the SDK is **DOM-mediated and must carry a serializable projection**; the generic module deserializes it and rebuilds the `Node` tree via the sub-block factories (`mountSectionedNav`, `mountButton`) before calling `mountAppShell`. So this decision also fixes that the config contract is a **JSON-serializable `ChromeConfig`**, not a pass-through of `AppShellConfig`.

## Why this is a decision, not a build

WE owns the nav/brand/footer (site information architecture = content); FUI owns the components (rendering). The docs-rendering boundary (#765's WE↔FUI-pair relaxation; WE never imports/renders FUI code, it only mounts it) forbids FUI owning WE's IA. So config must cross WE→FUI at mount time, and **how** is an undecided, reusable cross-repo convention — every future mode-C host that needs host-specific config inherits it. Picking it silently would be a quiet design call; filed as a decision instead (design forks are work items, not in-flight calls).

## Recommended path at a glance

| Fork | Question | Options | Recommended default | Confidence |
| --- | --- | --- | --- | --- |
| 1 | Transport channel | A data-on-mount-point · B contract change · ~~C FUI-hosted WE module~~ · D global | **A — data on the mount point, generic FUI reader, `<script type="application/json">` carrier** | ~80% |
| 2 | Mount granularity | A one shell mount · B per-region mounts | **A — one `app-shell` mount, one config blob** | ~75% |

Supported by default (not forks): the **serializable `ChromeConfig` projection** (forced by `AppShellConfig` holding live `Node`s — there is no non-DOM handoff in mode C, so a serializable schema is the only coherent shape, not a choice); **graceful degradation** to each block's self-contained `mountInDocument` default when config is absent/invalid (the SDK already does this — [`fui:in-document.ts:85-88`](../../frontierui/embed/in-document.ts)).

## Fork 1 — the transport channel (the core call)

*Fork-existence: A and B are genuinely-exclusive end-states for where the config contract lives — `data`/DOM-scraped on the mount point (no contract change) **xor** a typed argument on the #786 `EmbedMountModule` signature (a contract change touching every consumer). One convention has to be the canonical one; a mode-C host can't both depend on the contract carrying config and on it not. C is the excluded-broken branch (violates the #765 boundary). So this is a real either/or, not support-both.*

- **A (bold default) — host writes config as data on the mount point; a generic FUI module reads `root.host` and renders via the #870 factories.** WE emits the mount point with a `<script type="application/json">` config child (the survey's ergonomic refinement over a `data-chrome-config` attribute — no HTML entity-encoding of the deep nav tree, [Inertia #1389](https://github.com/inertiajs/inertia/discussions/1389)); the generic FUI module reads/parses it off `root.host`, builds the nav/footer/button `Node`s from the serializable `ChromeConfig`, and calls `mountAppShell(root, config)`. *Boundary-clean (WE owns content, FUI owns rendering), reuses #870's factories as-is, no contract change, generalizes to any mode-C host config, degrades gracefully (no/invalid config → the block's self-contained default), and matches the dominant third-party-embed convention (Stripe Elements, Cloudflare Turnstile receive host config via the mount element).* Residual after the sidecar refinement: a host must hand-author/serialize the `ChromeConfig` (mechanical; WE emits it from its 11ty data) — promote to B only if a host ever needs to pass live objects/functions config can't serialize.
- **B — extend the ratified mode-C contract so `mountInDocument(root, hostConfig?)` receives config the SDK lifts off the mount point.** Config becomes a first-class, typed argument (no dataset/script-scraping). Cost: changes the #786 `EmbedMountModule` contract ([`we:contract.ts:72-74`](../../frontierui/embed/contract.ts)) + the host SDK signature ([`fui:in-document.ts:89`](../../frontierui/embed/in-document.ts)) + the existing demo — touches every mode-C consumer for a need only the chrome has today. Clean **later promotion** if config outgrows the DOM-serializable shape.
- **C — a WE-docs-specific chrome module hosted in FUI (nav baked in).** Simplest build, but couples FUI to WE's IA (a WE nav change edits FUI) — **rejected on the constellation boundary (#765)**, recorded only to show it was considered.
- **D — WE sets a global (`window.__weChromeConfig`) the generic FUI module reads at boot.** Works, but global-state + load-ordering coupling; strictly worse than A's per-mount-point locality.

Recommendation: **A**, confidence **~80%**. Survey confirmed A and dissolved its original residual (JSON-in-attribute ergonomics) via the `<script type="application/json">` carrier. The residual is now only the serialize step; A keeps the #786 contract untouched and is the most-flexible/lowest-coupling option, B remains a clean later promotion. *Red-team note for the deciding turn:* the attack on A is "scraping config off the DOM is a typed-contract smell — B is cleaner." The rebuttal grounded in the tree: mode C **has no JS handoff point** (the SDK owns the import + call), so B doesn't avoid the DOM — the SDK still lifts `hostConfig` off the mount point; B only relocates the same scrape behind a signature change that taxes every consumer. A localizes it at the one host that needs it.

## Fork 2 — mount granularity (secondary; resolve with Fork 1)

*Fork-existence: one-mount vs per-region are genuinely-exclusive emission shapes — the host emits either a single `app-shell` mount that composes regions internally **xor** N independent region mounts with separate lifecycles; the skip-link/landmark order is owned in exactly one place, so the two can't both be canonical.*

One mount point for the whole shell (`we:app-shell.js` composes nav + buttons internally from one config blob) **(bold default — A)**, vs. one mount point per region (separate header / nav / footer / button mounts). A is simpler for the host (one `{% raw %}{% fuiChrome %}{% endraw %}` emission, one config), matches `app-shell` being the composing block ([`fui:AppShell.ts:77,144`](../../frontierui/blocks/app-shell/AppShell.ts)), and keeps the skip-link/landmark order correct in one place. Per-region only earns its keep if regions need independent lifecycles — not the case for static chrome. Confidence **~75%**; residual is whether the footer wants to mount independently of the header (cheap to split later).

## Out of scope (follow-on build, this card only decides)

Progressive-enhancement fallback for no-JS / pre-mount (the hand-written `we:base.njk` chrome must remain the SSR baseline so the page is navigable before/without the mount) is an implementation concern of #865, constrained by — not decided by — this fork.

## Resolution — ratified 2026-06-18 (A)

Mode-C host chrome config is passed as **DOM data on the mount point** (a `data-chrome-config` JSON read via `root.host`), not baked into FUI. Keeps WE from importing FUI and needs no contract change; revisit only if a config outgrows an attribute. Confirmed by the we-fui-embed-boundary rule (WE never imports FUI; config rides the mount). Unblocks #865. Reversible; ratified under the standing authorization for non-critical movable calls.
