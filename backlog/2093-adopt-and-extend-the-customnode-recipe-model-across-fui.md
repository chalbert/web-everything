---
kind: epic
size: 13
status: open
dateOpened: "2026-07-02"
tags: []
---

# Adopt and extend the CustomNode recipe model across FUI

The #2074 CustomNode recipe model — customNodes.define(class extends CustomNode), codified at we:docs/agent/block-standard.md#custom-node-recipes — is ratified but unbuilt. This epic (1) migrates FUI's existing delimiter plugs (webexpressions CustomTextNode; webdirectives CustomComment/Template/Script) onto the customNodes registry + CustomNode base, and (2) adds the new node kinds the model makes sense of: value shown/hidden, region inert(template)/live, marker include/directive. Each existing plug and each new recipe is a slice; the host stays a polyfill detail. Builds the standard to prove it.
