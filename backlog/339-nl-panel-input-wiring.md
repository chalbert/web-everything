---
type: idea
workItem: story
size: 3
status: open
blockedBy: ["328"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-13"
tags: [technical-configurator, natural-language, panel, plateau, ai-agnostic]
---

# Panel NL input wiring (populate Requirements state + degrade into the manual panel)

Wire a natural-language input box into the existing Technical Configurator panel in plateau-app: it calls the NL provider seam, populates the configurator's Requirements state from the returned (partial) map, and degrades gracefully into the panel's manual fine-tune mode for any axes the model left unset. Ratified in #096 (Forks 1 & 4): the panel-first surface reuses the most existing machinery (ranking, verdict badges, decision-record emitter) and is the cheapest demonstrable concept; partial-fill-then-complete is the honest default whose failure mode *is* the configurator's manual mode. Blocked on the NL provider seam (#328).
