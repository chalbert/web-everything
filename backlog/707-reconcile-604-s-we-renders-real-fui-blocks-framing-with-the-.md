---
type: decision
workItem: story
size: 2
status: open
dateOpened: "2026-06-15"
tags: []
---

# Reconcile #604's 'WE renders real FUI blocks' framing with the #700/#701 iframe boundary

The #604 epic (migrate the WE site to render real Frontier UI blocks) was authored 2026-06-14 — before the #700 DC-7 ruling + #701 iframe viewer (2026-06-15) established that WE never imports or renders FUI block code, only embeds FUI-hosted demos via an iframe. Its acceptance still says 'the WE site renders a live interactive instance of the real FUI block', 'HMR on the FUI source updates the page', and Fork-2 'import the @frontierui package surface'. Decide: realign #604 wholesale to the iframe boundary (its demos become FUI-hosted, WE iframes them), or carve an explicit, justified exception where WE genuinely renders FUI source. Default: realign to iframe — no WE→FUI import seam exists and #700 ruled cross-repo import out. Then edit #604's body/acceptance to match.
