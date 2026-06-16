---
type: issue
workItem: story
size: 3
status: resolved
parent: "728"
blockedBy: ["807", "786"]
locus: frontierui
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: frontierui/embed/__tests__/e2e/embed-b1-overlay.spec.ts + embed-c-in-document.spec.ts + demos/embed-dialog{,−in-document}.* — B1/mode-C demos, CI proofs, vite prod build target
tags: [frontierui, embed-sdk, render-mode, overlay-escape, dialog, ci, build]
---

# Exercise FUI embed SDK B1 overlay-escape end-to-end — Dialog demo + CI proof + prod build target

#807 built the FUI embed-SDK skeleton (contract + host + guest, modes A/B1) and verified it at the build/type/gate level + that the dev server serves and injects it. Two runtime/packaging pieces remain to prove and ship B1: (1) author a concrete **Dialog-family demo** (the #732 trigger — `<dialog>.showModal()`) embedded via `fuiDemo "…", …, "B1"`, and a Playwright test asserting the overlay escapes the iframe box to cover the host docs page (and reverts on close); (2) add a **production build target** that emits `embed-host.js`/`embed-guest.js`/`in-document.js` for the published demos host (`FUI_DEMO_BASE` in prod), since the dev server serves the `.ts` directly today; and (3) **mode C (#786)** — author a demo module exporting `mountInDocument(root)` and a Playwright proof that a `<dialog>` mounted in-document escapes natively to the host top layer (zero coordination), vs the B1 iframe-promote path. Unblocked by #807 + #786.

## Progress — all three delivered (2026-06-16, locus frontierui)

- **(1) Dialog-family demo + B1 CI proof** — `demos/embed-dialog.html` (native `<dialog>.showModal()`,
  the #732 trigger) embedded by the `demos/embed-b1-host.html` harness (stands in for WE's host docs
  page so B1 runs in FUI's own CI). `embed/__tests__/e2e/embed-b1-overlay.spec.ts` asserts the frame
  leaves its box (gains `.fui-embed--overlay`, covers the viewport) on open and reverts on close. **Passing.**
- **(2) Production build target** — `vite.config.mts` adds three rollup entries with stable unhashed
  names; `vite build` now emits `dist/embed/embed-host.js` / `embed-guest.js` / `in-document.js` for the
  published demos host (`FUI_DEMO_BASE`). Verified emitted.
- **(3) Mode C (#786) demo + CI proof** — `demos/embed-dialog-in-document.ts` exports `mountInDocument(root)`;
  `demos/embed-c-host.html` mounts it in-document (no iframe). `embed/__tests__/e2e/embed-c-in-document.spec.ts`
  asserts the dialog escapes natively to the host top layer with zero coordination. **Passing.**

`playwright.config.ts` testMatch extended to `embed/**/__tests__/**`. `embed/README.md` updated (the three
follow-ups moved from "Not yet" to "Exercised end-to-end"; only B2/#764 remains reserved). FUI gate green
(0/0); both e2e specs pass against :3001.
