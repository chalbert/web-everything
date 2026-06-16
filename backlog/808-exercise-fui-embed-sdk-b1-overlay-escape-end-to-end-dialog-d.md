---
type: issue
workItem: story
size: 3
status: open
parent: "728"
blockedBy: ["807", "786"]
locus: frontierui
dateOpened: "2026-06-16"
tags: [frontierui, embed-sdk, render-mode, overlay-escape, dialog, ci, build]
---

# Exercise FUI embed SDK B1 overlay-escape end-to-end — Dialog demo + CI proof + prod build target

#807 built the FUI embed-SDK skeleton (contract + host + guest, modes A/B1) and verified it at the build/type/gate level + that the dev server serves and injects it. Two runtime/packaging pieces remain to prove and ship B1: (1) author a concrete **Dialog-family demo** (the #732 trigger — `<dialog>.showModal()`) embedded via `fuiDemo "…", …, "B1"`, and a Playwright test asserting the overlay escapes the iframe box to cover the host docs page (and reverts on close); (2) add a **production build target** that emits `embed-host.js`/`embed-guest.js`/`in-document.js` for the published demos host (`FUI_DEMO_BASE` in prod), since the dev server serves the `.ts` directly today; and (3) **mode C (#786)** — author a demo module exporting `mountInDocument(root)` and a Playwright proof that a `<dialog>` mounted in-document escapes natively to the host top layer (zero coordination), vs the B1 iframe-promote path. Unblocked by #807 + #786.
