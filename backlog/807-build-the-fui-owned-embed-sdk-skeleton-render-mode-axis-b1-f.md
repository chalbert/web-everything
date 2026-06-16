---
type: issue
workItem: story
size: 5
status: open
parent: "728"
dateOpened: "2026-06-16"
tags: [frontierui, embed-sdk, render-mode, iframe, overlay-escape]
---

# Build the FUI-owned embed SDK skeleton + render-mode axis (B1 first, per #732)

The foundational embed-SDK build #732 ruled "B1 builds first (carved under #728)" but which was **never actually filed or built** — verified 2026-06-16: no `*embed*` / render-mode code exists anywhere in `frontierui` (`graduatedTo: none` on #732; #728's only children are the decisions #732/#765 and the two *extension* modes #764/#786). Both #764 (B2) and #786 (mode C) are framed as "an additional value of the render-mode axis" of this SDK — they cannot be built until the SDK and its axis exist. Build a FUI-owned, WE-loaded embed SDK behind a stable embed contract (impl→FUI, never the #700 source import) with a render-mode axis: **mode A (contained)** as the free default, **B1 (host-restyle overlay escape)** as the first opt-in; WE's `fuiDemo` shortcode gains the per-demo mode opt-in.

## Unblocks
- **#786** (mode C — Shadow-DOM in-document mount) `blockedBy` this — it adds a third value to the axis this item creates.
- **#764** (B2 — native host backdrop overlay) is the same shape (another axis value); it should also depend on this skeleton.

Origin: traced while picking up #786 in batch-2026-06-16 — #786's premise assumed a substrate (the #732 A/B1/B2 SDK) that does not exist; this fills the gap the #732 ruling left uncarved.
