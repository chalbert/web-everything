---
type: issue
workItem: story
size: 5
status: resolved
parent: "728"
locus: frontierui
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: [frontierui, embed-sdk, render-mode, iframe, overlay-escape]
---

# Build the FUI-owned embed SDK skeleton + render-mode axis (B1 first, per #732)

The foundational embed-SDK build #732 ruled "B1 builds first (carved under #728)" but never filed or built — verified 2026-06-16: no embed/render-mode code exists in `frontierui`. #764 (B2) and #786 (mode C) both extend "the render-mode axis" of this SDK and can't be built until it exists. Build a FUI-owned, WE-loaded embed SDK behind a stable embed contract (impl→FUI, never the #700 source import) with a render-mode axis: **mode A (contained)** the free default, **B1 (host-restyle overlay escape)** the first opt-in; WE's `fuiDemo` shortcode gains the per-demo mode opt-in.

## Unblocks
- **#786** (mode C — Shadow-DOM in-document mount) `blockedBy` this — it adds a third value to the axis this item creates.
- **#764** (B2 — native host backdrop overlay) is the same shape (another axis value); it should also depend on this skeleton.

Origin: traced while picking up #786 in batch-2026-06-16 — #786's premise assumed a substrate (the #732 A/B1/B2 SDK) that does not exist; this fills the gap the #732 ruling left uncarved.

## Progress (2026-06-16, batch-2026-06-16)

Built the FUI-owned embed SDK skeleton in `frontierui/embed/`:

- **`contract.ts`** — the wire contract: `EMBED_PROTOCOL_VERSION`, the `RenderMode` enum
  (`contained`/A, `host-restyle`/B1 implemented; `host-backdrop`/B2 + `in-document`/C reserved
  enum slots so adding them is non-breaking, per #732), the `MODE_PARAM`/alias map, the
  guest↔host message shapes (`ready`/`init`/`resize`/`overlay-open`/`overlay-close`), and the
  origin-validated `isEmbedMessage` guard + `envelope` helper.
- **`embed-host.ts`** — runs in WE's docs page (the FUI-published bundle WE loads). Finds
  `iframe[data-embed-mode]`, matches messages to a frame by live `contentWindow` + validated
  origin, and realizes the mode: `resize` → grow the frame (mode A, shared); `overlay-open`/
  `-close` → mode B1 promote the frame to fixed/full-viewport via an SDK-injected style. Auto-boots.
- **`embed-guest.ts`** — runs in the demo iframe. **Self-gates on `?embed-mode=`** (absent →
  fully dormant, so legacy static embeds are byte-identical). Reports content height (mode A) and,
  for B1, auto-detects native overlays (`<dialog>[open]` via MutationObserver + Popover `toggle`)
  plus a manual `window.fuiEmbed` API; posts to the validated host origin. Auto-boots.
- **`index.ts`** + **`README.md`**; guest injected into every demo by a new `embedGuestInject`
  Vite plugin (`vite.config.mts`), mirroring `bootstrapPatches`.
- **WE `fuiDemo` shortcode** (`webeverything/.eleventy.js`) gained a 4th `mode` arg: no mode =
  legacy static iframe (unchanged); a mode appends `?embed-mode=`, tags the frame
  `data-embed-mode`, and loads `embed-host.ts` once (module-deduped). WE passes only the token —
  the impl stays in FUI (impl→FUI; no #700 source import).

**Verified:** FUI `check:standards` 0 err; WE `check:standards` 0 err; WE 11ty `--dryrun` build
smoke clean; `tsc --noEmit` (strict, bundler res, dom lib) clean on `embed/`; the running :3001
dev server serves both SDK halves and auto-injects the guest into demos.

**Left to follow-up (filed):** a concrete Dialog-family demo exercising B1 overlay-escape
end-to-end in CI, and a production build target emitting `embed-*.js` for the published demos host
(dev serves the `.ts` directly today, matching how demos load). #764 (B2) and #786 (mode C) now
have their substrate.
