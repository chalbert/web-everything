---
kind: decision
status: open
relatedProject: webvalidation
blocks: ["1790"]
relatedReport: reports/2026-06-26-split-analysis-1783.md
dateOpened: "2026-06-26"
tags: [conformance, constellation-placement, runner-home, plateau, frontierui]
---

# Home of the generic conformance runner given the FUI-origin mode-C-bundle requirement (#899 backends→FUI vs #1597 runner→plateau)

#1784 needs the WE docs site to mode-C-load a FUI-origin conformance-runner bundle, but the generic runner (zero plateau-specific deps) is homed in plateau (#1597 'neutral runner'). FUI cannot import plateau (backward edge), and a plateau-origin bundle fails mode-C's #765 trust gate — so the runner's home must be resolved: re-home plateau to FUI as a reference-impl-tier engine (per #899 'backends to FUI'), widen the #765 trust allowlist, or a controlled thin-FUI-runner variant. Gates #1783 Slice B.
