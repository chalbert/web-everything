---
kind: story
size: 5
parent: "728"
status: resolved
blockedBy: ["765", "807"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: []
---

# Mode C: FUI embed SDK gains a Shadow-DOM in-document render mode; fuiDemo gains the opt-in

Build the in-document (mode C) render path ratified in #765. The FUI-owned embed SDK gains a Shadow-DOM-encapsulated in-document mount as an additional value of its render-mode axis (alongside #732's A/B1/B2 iframe modes): for the trusted WE↔FUI pair only, a FUI component mounts directly in WE's host DOM behind a shadow root so native top-layer overlays escape with zero coordination. WE's fuiDemo shortcode gains an opt-in to select mode C per demo, iframe staying the default. Runtime SDK only — never the #700 source import (no frontierui alias). Priority is the open knob; gated blockedBy #765.

## Blocked-in-fact — re-pointed 2026-06-16 (batch-2026-06-16, claimed then released)
Picked this up to build and found the substrate it extends **does not exist**. Mode C is "an additional value of the render-mode axis (alongside #732's A/B1/B2 iframe modes)" — but that embed SDK and its render-mode axis were **never built**: #732 is a resolved *decision* (`graduatedTo: none`) that ruled "B1 builds first (carved under #728)", yet no B1 build was ever filed, and `frontierui` contains **zero** embed/render-mode code (verified by search). #765 (the boundary-relax decision) being resolved is necessary but not sufficient — there is no axis to add mode C to.

Filed the missing foundational build as **#807** (the FUI embed-SDK skeleton + render-mode axis, B1 first) and added it to this item's `blockedBy`. Released back to `open`; this unblocks once #807 ships the SDK + axis. (#764 / B2 is in the same position.)

## Progress (2026-06-16, batch-2026-06-16 — cascade-freed by #807)

#807 shipped the SDK substrate (with `in-document` reserved as an enum slot in the
`RenderMode` contract); built mode C on top:

- **`fui:frontierui/embed/in-document.ts`** — the mode-C mount path. For a non-iframe mount point
  (`[data-embed-mode="in-document"]` with `data-embed-src` = the demo module URL): a **trust
  gate** (origin allowlist, default `[location.origin]`, widenable via `setTrustedOrigins` —
  belt-and-braces on top of the per-demo opt-in), then `attachShadow({mode:'open'})`,
  `import()` the demo module, and call its `mountInDocument(root)` export. **Graceful fallback**
  (a shadow-root notice) when the origin is untrusted, the module lacks the export, or the import
  fails — never breaks the host page. Runtime FUI bundle only; **no #700 source import / no
  `frontierui` alias** (impl→FUI intact, per #765's sharpened crux).
- **`we:contract.ts`** — added the `EmbedMountModule { mountInDocument(root: ShadowRoot) }` contract
  + `hasMountInDocument` guard; `in-document` moved from reserved → `IMPLEMENTED_MODES`.
- **`fui:embed-host.ts`** — its scan now also mounts mode-C points (idempotent, re-runs on DOM
  mutation alongside the iframe wiring).
- **WE `fuiDemo` shortcode** (`we:.eleventy.js`) — `mode: "C"`/`"in-document"` emits a **mount-point
  `<div>`** (not an iframe) carrying `data-embed-mode="in-document"` + `data-embed-src`, and loads
  the host SDK. The iframe stays the default for every other mode (#765's "opt-in + iframe-default"
  guard rail). WE passes only the token; the mount impl lives entirely in FUI.

**Verified:** FUI `check:standards` 0 err; WE `check:standards` 0 err; WE 11ty `--dryrun` clean;
`tsc --noEmit` (strict, bundler res, dom lib) clean on `embed/`; :3001 serves `fui:in-document.ts`.

**Follow-up:** a concrete mode-C demo exporting `mountInDocument` + a Playwright proof that a
`<dialog>` escapes natively to the host top layer — folded into the #808 end-to-end proof item
(B1 + now C). B2 (#764) remains the one reserved axis slot.
