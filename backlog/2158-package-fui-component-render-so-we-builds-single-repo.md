---
kind: decision
size: 5
status: open
dateOpened: "2026-07-02"
tags: [deploy, ci, fui, build, cross-repo]
---

# Package FUI component-render so the WE site builds single-repo (drop the cross-repo CI checkout)

## Digest

WE's Eleventy `build:docs` shells out to FUI's component-render tool at
`we:../frontierui/dist/tools/component-render/cli.mjs` (ratified #1946/#2016), so the site **cannot be
built by any single-repo CI**. The live auto-deploy (#1137) works around this by checking out and building
the sibling `chalbert/frontierui` in GitHub Actions (a FUI-read PAT + a full FUI `build:tools` per deploy,
~2 min). Package the component-render tool (and its `data-table` sibling) as a **consumable artifact WE
installs as a dependency** — like the other `@frontierui/*` packages — so `build:docs` resolves it from
`node_modules` and any single-repo build (GitHub Actions, Cloudflare Workers Builds, a fresh clone) works
with no sibling checkout, no PAT, and no per-deploy FUI build.

## Why

The cross-repo build is the single most fragile part of the deploy path:

- It needs a **fine-grained PAT** (`FUI_READ_TOKEN`) with read access to a *second* private repo, held as a
  GitHub Actions secret — an extra credential to rotate and a cross-repo coupling.
- Every deploy does a full `npm ci` + `build:tools` of FUI (~2 min) just to produce one CLI artifact.
- It silently rules out Cloudflare's **native Workers Builds** (single-repo only) — the reason #1137 fell
  back to hand-rolled GitHub Actions rather than the zero-YAML native path.
- A fresh clone of `we:` alone can't build the docs, which surprised this session (the "single-repo build
  verified" claim was wrong precisely because the dev machine happened to have the FUI sibling).

## Shape (to design)

The tool graduated to `frontierui:blocks/renderers/component-render/buildHarness.ts` (#2016). Options to
weigh: publish it under the existing `@frontierui/*` npm line (WE already consumes `@frontierui/plugs`
etc. as packages — this fits the contract-distribution end-state), vs. a prebuilt artifact vendored/fetched
at build time, vs. pinning a version so WE's build is reproducible against a known FUI. The pin question
(#1946/#2016 "pinned FUI artifact") is real: whatever the mechanism, WE should build against a **declared
FUI version**, not "whatever sibling is on disk".

## Done when

`npm ci && npm run build:docs` succeeds in a fresh single-repo checkout of `we:` (no `../frontierui`
present), and `we:.github/workflows/deploy.yml` drops the FUI checkout + `FUI_READ_TOKEN`. Relates to
#1137 (the workaround it removes) and #2016 (the tool it distributes).
