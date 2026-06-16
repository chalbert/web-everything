---
type: idea
workItem: story
size: 2
parent: "604"
status: open
dateOpened: "2026-06-16"
tags: []
---

# Embed FUI droplist demo on /blocks/autocomplete/ + establish the fuiDemo rollout pattern & demo→block mapping

POC + repeatable pattern for #604: add a one-line {% fuiDemo "autocomplete-unplugged.html" %} embed to the autocomplete block description partial (the droplist-family demo FUI already hosts), mirroring component.njk:235; document the per-block demo→block mapping convention (demoFile in blocks.json or the partial) so remaining blocks roll out as one-liners. Additive — static code sample retained.
