---
type: idea
workItem: story
size: 8
parent: "746"
locus: frontierui
status: open
relatedProject: webdocs
crossRef: { url: /backlog/809-block-explorer-workbench-render-locus-manipulation-channel-f/, label: "Ratifying decision (#809)" }
dateOpened: "2026-06-16"
tags: [frontierui, block-explorer, workbench, embed, iframe, distribution, chrome, locus]
---

# FUI-owned block workbench — the iframe+chrome distribution (chrome decoupled from rendering, embeddable anywhere)

The FUI-hosted, FUI-owned interactive block workbench ratified by #809: chrome (theme switcher / trait panel / inspect panels) and the rendered block are served same-origin inside one iframe, so manipulation + inspection are intra-FUI host-side DOM with no WE↔FUI channel. Any site (WE included) embeds it via a plain iframe — the "iframe + chrome" distribution, separate from mode C's "in-document, no-chrome" bare-component one (#765/#786). This is the shell the re-homed Block-Explorer slices (#749/#750/#755/#806) build into; `impl→FUI` and `@frontierui` scope hold. WE's standards panels stay a WE-docs overlay around the embed, not part of this FUI workbench.

## Build (the shell — slices fill it in)

- A FUI-hosted workbench page/widget that mounts a chosen FUI block alongside its control chrome, **same-origin**, addressable by block id (e.g. `…/workbench?block=button`).
- Manipulation + inspection are host-side DOM **inside** the workbench (set `--token` custom properties, set/toggle attributes, `querySelector`/`getComputedStyle`/shadow-DOM reads) — no postMessage manipulation protocol.
- Embeddable on any site via a plain `<iframe>`; overlay escape for the embedding frame reuses the existing #732 modes (B1/B2), independent of this workbench's internals.
- The chrome is **decoupled from rendering**: the same FUI block also distributes via mode C (#765/#786) **without** chrome (the bare in-document component). This item owns only the *iframe + chrome* distribution.

## Boundary (what this does NOT own)

- The bare in-document (mode C, no-chrome) distribution → #786 (already built).
- WE's **standards** panels (intent→ARIA mapping, token provenance #747/#364, the #092 provider↔consumer graph) → a **WE-docs overlay** rendered around the embedded workbench from WE's own data, NOT part of this FUI product (#755 split).

## Acceptance

- [ ] A FUI-hosted workbench renders a selected FUI block + control chrome same-origin, embeddable via iframe on a third-party origin.
- [ ] Live theme/trait changes + at least one rendered-component inspector work host-side with no manipulation protocol.
- [ ] WE's block "do" page embeds the workbench iframe and wraps it with the WE-standards overlay.

## Notes

Ratified by **#809** (chrome decoupled from distribution; Fork 1 dissolved, Fork 2 → B). FUI-locus build;
the re-homed slices **#749/#750/#755/#806** are `blockedBy` this shell. `impl→FUI` holds — FUI owns the
rendering *and* the workbench that drives it; WE renders no FUI block code.
