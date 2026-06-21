---
kind: task
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/blocks/composite-widget.json"
tags: []
---

# Promote focus-delegation + composite-widget (toolbar realizing work)

Per #1409 ruling: toolbar's roving container is the existing focus-delegation intent + composite-widget block, consumed via the webdocs toolbar assemblerPreset — no new toolbar artifact. Realizing work: promote focus-delegation from status draft and composite-widget from status concept (give composite-widget a role parameter so a consumer can set role=toolbar), keeping the toolbar preset as the recipe. The thin toolbar block is NOT in scope — it is gated on a 2nd container consumer (menubar/tabs) per the #1409 graduation trigger.

## Progress (batch-2026-06-21)

- `we:src/_data/intents/focus-delegation.json` — `status` draft → **active**.
- `we:src/_data/blocks/composite-widget.json` — `status` concept → **active**; added `implementsIntent:
  focus-delegation` and a `role` **parameter** (the ARIA role applied to the roving container; set
  `role=toolbar` to realize the #1409 toolbar preset; examples menubar/tablist/listbox/tree/grid/radiogroup).
- Thin toolbar block left out of scope per #1409 (gated on a 2nd container consumer). `check:standards` green.
