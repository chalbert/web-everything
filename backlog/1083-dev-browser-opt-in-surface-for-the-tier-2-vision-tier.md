---
kind: story
size: 3
parent: "1073"
status: open
blockedBy: ["1391"]
dateOpened: "2026-06-19"
tags: []
---

# Dev-browser opt-in surface for the Tier-2 vision tier

Slice D of #1073: the opt-in download + UI that surfaces the Tier-2 rich output inside the dev browser ([monetization](docs/agent/platform-decisions.md#monetization), #141) — download/invoke/render. Gated on the dev-browser **shell** existing — the shell build is now filed as [#1391](/backlog/1391-dev-browser-shell-build-chromium-shell-embedding-plateau-app/) (#141's staged successor), which this slice `blockedBy`-depends on. Until #1391 ships, slice C's (#1082, resolved) standalone demo is the demoable home for the Tier-2 output. (Earlier prose blocker #1082 is resolved as of 2026-06-19; the real remaining gate is the shell, #1391.)

## Status: blocked, not build-ready (prep finding, 2026-08-15)

Re-verified against the live tree and current backlog state: **the premise still holds, unchanged.** This
is not a stale block — the shell genuinely does not exist yet.

- `plateau:packages/dev-browser/src/` has no `shell/` directory at all (checked directly, 2026-08-15) —
  only the existing capability modules (`capture/`, `ide-bridge/`, `fault-injector/`,
  `intent-inspector/`, `variant-simulator/`, `feature-lighting/`, etc.). No `BrowserWindow` code exists
  anywhere in the package, though `electron@^38.8.6` is installed as a dependency of this package (#2342,
  resolved 2026-07-09) ready for it to be used.
- [#1391](/backlog/1391-dev-browser-shell-build-chromium-shell-embedding-plateau-app/) (the shell epic)
  is `status: open`. Its own `blockedBy: ["2342"]` is satisfied (#2342 resolved), but that only means the
  epic is *unblocked to start* — not shipped. Its foundational slice,
  [#1753](/backlog/1753-dev-browser-shell-scaffold-stock-chromium-desktop-shell-we-c.md) (S1: the actual
  `BrowserWindow` + conformance-probe-on-load scaffold everything else nests under), was itself only just
  brought to build-ready **today** (`lane/prepare-1753`, PR #1309, merged 2026-08-15) — it is prepared,
  not built. Its own card still carries `status: open` and a `humanGate` noting the final boot-verify step
  needs a session with a real display.
- S2–S5 ([#1754](/backlog/1754-dev-browser-shell-navigation-interception-not-we-compatible-.md),
  [#1755](/backlog/1755-dev-browser-shell-conformance-gated-feature-lighting-capabil.md),
  [#1756](/backlog/1756-dev-browser-shell-embed-plateau-app-config-panels-via-direct.md),
  [#1757](/backlog/1757-dev-browser-shell-license-gating-wiring-commercial-use-licen.md)) are all
  `blockedBy: ["1753"]` and `status: open` — none started.

So #1083's own `blockedBy: ["1391"]` stays exactly as it is; no re-scope, no fork to name, nothing to
force. The right move per `we:agent-memory-src/story-preparation-checklist.md` is to say so plainly
rather than design against a shell that isn't there yet.

## What's already decided, so a future prep pass doesn't start cold

Once #1391 (in practice: once #1753 ships and a panel-embed seam like #1756's exists to hang UI off), the
shape of this slice is already knowable from what's shipped upstream of it — nothing here needs a fresh
design fork:

- **What ships already, ready to wrap.** The Tier-2 provider core is done and self-registering —
  `we:scripts/design-refs/providers/transformers-vlm.mjs` (#1082, resolved) wraps Florence-2 via
  `@huggingface/transformers` + WebGPU behind `registerVisionProvider('transformers-vlm', { analyzeRich })`,
  device-gated (`assertDeviceCapable` throws when `navigator.gpu` is absent). Its standalone demo,
  `we:demos/tier2-vlm-demo.html` (#1142, resolved), is the existing proof of the exact
  download → invoke → render sequence this card needs to move into the shell chrome: opt-in ~2GB Florence-2
  download, `analyzeRich({ pngBase64, dims })` call, rendering the `{description, tags, regions}` envelope
  (caption + tag list + region overlay).
- **Consumer/embed precedent.** #1756 (S4) establishes the seam this slice would reuse — direct
  `mount*(el)` package import (#1654's ratified boundary, no iframe/web-component), the same pattern
  `mountTechnicalConfigurator`/`mountIntentConfigurator`/`mountProfiles` use. This slice's UI (download
  trigger + invoke button + envelope render) would mount the same way, as a capability module alongside
  the shell's existing `capture/`, `ide-bridge/`, `fault-injector/`, `intent-inspector/`,
  `variant-simulator/` modules — gated by #1755's (S3) capability-manifest lighting, since Tier-2 vision is
  exactly the kind of device-gated, opt-in feature that gate exists for (WebGPU ~2GB+, never default/mobile,
  per `we:docs/agent/vision-tiers.md`'s "Deployment homes" table).
- **Size/shape hold up.** `size: 3` and the one-line shape ("download/invoke/render") were already right
  when filed — the two hard parts (the provider, the rich-output contract) are both shipped upstream
  (#1080, #1081, #1082); what's left really is thin UI wiring once there's a shell to wire it into. No
  re-slice needed.

This section is informational only — it does not make the item build-ready. The gate is real and external
to this card: #1753 needs to actually ship (build session with a display, per its `humanGate`) before any
of the above can be built against a live shell.
