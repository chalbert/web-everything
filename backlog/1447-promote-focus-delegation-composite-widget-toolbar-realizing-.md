---
kind: task
status: open
blockedBy: []
dateOpened: "2026-06-21"
tags: []
---

# Promote focus-delegation + composite-widget (toolbar realizing work)

Per #1409 ruling: toolbar's roving container is the existing focus-delegation intent + composite-widget block, consumed via the webdocs toolbar assemblerPreset — no new toolbar artifact. Realizing work: promote focus-delegation from status draft and composite-widget from status concept (give composite-widget a role parameter so a consumer can set role=toolbar), keeping the toolbar preset as the recipe. The thin toolbar block is NOT in scope — it is gated on a 2nd container consumer (menubar/tabs) per the #1409 graduation trigger.
