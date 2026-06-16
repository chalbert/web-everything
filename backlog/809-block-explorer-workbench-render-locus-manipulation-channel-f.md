---
type: decision
workItem: story
size: 3
status: open
parent: "746"
dateOpened: "2026-06-16"
tags: [webdocs, block-explorer, boundary, locus, embed-sdk, render-mode, decision]
---

# Block-Explorer workbench: render-locus + manipulation-channel for live theme/trait/inspect (#746 cluster)

The #746 children that *manipulate the rendered FUI block* (#749/#750/#755/#806) sit on a fork the loader can't see: filed WE-locus while #746 says the workbench "lives in FUI," and #727's "live render" is a FUI **demo iframe** WE can't reach across the origin boundary. #807/#786 built overlay-escape + mode-C in-document mount, but no theme/trait/inspect channel. Decide **(1)** the channel — standardize on mode C (WE drives the block via shadow-host vars/attrs/queries) vs an iframe message protocol — and **(2)** the UI locus (FUI workbench vs WE chrome). Settling both unblocks the four.

## Fork 1 — manipulation channel: in-document (mode C) vs iframe message protocol

- **A — standardize the workbench on mode C (in-document mount)** *(leaning)*. The block renders in WE's own DOM behind a shadow root (#786, ratified #765, WE↔FUI-only). WE then sets theme via CSS custom properties on the shadow host, toggles traits via attributes, and inspects via shadow-DOM queries + computed styles — all host-side, **zero new protocol**. Merit: maximal fidelity, simplest channel, reuses the just-built mode C. Cost: every manipulable demo must be mode-C capable (export `mountInDocument`), and it leans on the trust-gated exception rather than the default iframe.
- **B — keep the iframe and grow an explicit manipulation protocol.** Extend the embed SDK contract with `set-theme` / `set-trait` / `inspect` host→guest messages over the origin-validated channel (the A/B1 channel #807 built). Merit: keeps the default isolation boundary; works for any embedder. Cost: a much larger bidirectional protocol, and inspection (computed styles / ARIA / token trace) is awkward to marshal across the frame.

## Fork 2 — manipulation-UI locus: FUI workbench vs WE docs chrome

Per #746 the workbench "lives in FUI"; the slices are filed WE-locus. Decide whether the control surfaces (switcher, trait panel, inspect panels) are a **FUI-owned workbench component** WE embeds (consistent with the epic + the constellation impl→FUI rule) or **WE docs chrome** that drives a FUI-rendered block. This sets the `locus` for #749/#750/#755/#806 and whether they need re-homing.

Surfaced 2026-06-16 (batch-2026-06-16) when the cluster pre-flighted as "batchable" (all `blockedBy` resolved) yet was un-buildable across the boundary. The four items now `blockedBy` this decision so the loader stops mis-reporting them as agent-ready.
