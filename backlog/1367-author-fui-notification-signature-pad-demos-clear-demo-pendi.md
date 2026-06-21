---
kind: story
size: 3
locus: frontierui
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:demos/notification-demo.html"
tags: [frontierui, demos, blocks]
---

# author FUI notification + signature-pad demos (clear DEMO_PENDING from #1361)

#1361 registered `notification` + `signature-pad` in `fui:src/_data/blocks.json` to clear the #784
catalog-completeness red, but their self-bootstrapping demos are not yet authored, so both ids sit on the
`DEMO_PENDING` allowlist in `fui:scripts/check-standards.mjs` (#972/#973). Author a `fui:demos/` page for
each — a `<notification-region>` show/dismiss demo (severity-mapped live-region + paused auto-timeout) and
a `<signature-pad>` typed-name + opt-in canvas demo — wire each entry's `demoFile`, browser-verify on
:3001, then remove the two ids from `DEMO_PENDING` so the every-block-has-a-demo invariant (#973) holds
empty again.

## Progress (batch-2026-06-20-1372-1369)

Done. Authored both self-bootstrapping demos and cleared the allowlist:
- `fui:demos/notification-demo.html` — registers `<notification-region>` via `registerNotificationRegion()`;
  buttons drive `show({message, severity, action})` for info/success/warning/error + an Undo-action message
  + `dismiss(lastId)`; listens for `notification-shown`/`-dismissed`/`-action` and shows a live count.
- `fui:demos/signature-pad-demo.html` — registers `<signature-pad>` via `registerSignaturePad()`; a typed
  (default) pad + a `method="draw"` drawn-enhancement pad, each with an affirmation gate; listens for `sign`
  and renders the immutable Signature Record JSON.
- Wired `demoFile` on both entries in `fui:src/_data/blocks.json`; emptied `DEMO_PENDING` in
  `fui:scripts/check-standards.mjs` (comment kept explaining the now-empty invariant).

**Browser-verified on :3001 (Playwright, real browser):** notification — 3 shows → 1 live card (default
stackLimit=1 replace, shown:3/dismissed:2) → dismiss → 0; severity→role mapping renders; no console errors.
signature — fill name + accept affirmation → Sign enables → `sign` fires → Signature Record (`signer: "Ada
Lovelace"`, `signedAt`, `method: typed`) rendered. FUI `check:standards` 0 errors, 47/47 blocks demo-complete.
