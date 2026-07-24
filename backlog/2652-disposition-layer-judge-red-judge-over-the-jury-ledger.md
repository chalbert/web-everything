---
bornAs: xw3oxtg
kind: story
size: 8
parent: "2636"
status: open
scope: ["we:scripts/lib/"]
dateOpened: "2026-07-24"
tags: []
---

# Disposition layer — judge + red-judge over the jury ledger

A care-gated disposition policy over the jury ledger: a green judge proposes auto-dispose vs escalate, a red-judge adversary tries to refute an auto-clear, and auto-dispose survives only an unrefuted red pass.

**Ratified as a forward-fit (build to receive, don't build now).** Disposition is a separate seam from the fan-out, modeled as JUDGE + RED-JUDGE. The green judge proposes either auto-dispose or escalate-to-human; the red judge then tries to refute an auto-clear; an auto-dispose only survives an **unrefuted** red pass. The ledger records the full disposition trail. Decision record: https://claude.ai/code/artifact/273a2dbd-402d-4bd4-98f4-ec45475a7052

This is a **deliberate, separately-ratified relaxation** of #2576's "the human disposes" — it is not assumed, it must be turned on as its own ruling, and until then the human still disposes. It is **distinct from #2637**: #2637 red-teams the *roster* (did we pick the right jury?); this red-teams the *disposition* (is the auto-clear actually safe?).

Lives in the WE core at [we:scripts/lib/](scripts/lib/), care-gated like the rest of the engine.
