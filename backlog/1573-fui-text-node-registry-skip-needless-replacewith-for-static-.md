---
kind: task
status: open
dateOpened: "2026-06-22"
tags: []
---

# FUI text-node registry: skip needless replaceWith for static-only text segments

In fui:plugs/webexpressions/CustomTextNodeParser.parse(), a text run with no delimiters returns a FRESH new Text(remaining), so CustomTextNodeRegistry.#upgradeTextNode replaceWith()-swaps every static/whitespace text node with an equal one on each upgrade — pointless DOM churn (and it was the proximate trigger of the #1207 TreeWalker-abort, now fixed structurally by snapshotting nodes before mutating). Cleanup: when the parse yields a single node equal to the original (or skip replace when determinedTextNodes deep-equals [element]), leave the node in place. Pure efficiency/clarity; behavior already correct after #1207.
