---
kind: story
size: 5
parent: "2094"
status: open
blockedBy: ["2113", "2110"]
dateOpened: "2026-07-02"
tags: [custom-nodes, delimiter-grammar, bundle, liquid, jinja]
---

# Liquid/Jinja delimiter bundle

Ship the Liquid/Jinja bundle: dual-sigil {{ }} + {% %} with end-prefix name-echo closes ({% for %}…{% endfor %} — a second declared-close shape stressing Fork 3), {% raw %} verbatim escape (the mandatory escape hatch), {# #}/{% comment %} hidden. One bundle: the delimiter skeleton is shared; Liquid↔Jinja divergence is expression vocabulary (filters/tags), out of grammar scope — fork a second bundle only if the gap lists diverge. Scored via #2113; gap list published as a we:reports/ topic.
