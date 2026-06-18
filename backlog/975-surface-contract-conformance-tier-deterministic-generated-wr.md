---
type: issue
workItem: story
size: 3
status: open
dateOpened: "2026-06-18"
tags: []
---

# Surface-contract conformance tier — deterministic generated-wrapper-vs-CEM check + workbench badge

Graded-conformance surface tier ratified by #913. Build a DETERMINISTIC (no live sandbox) check that the genWrapper-emitted React/Vue wrapper exposes exactly the props/events/slots/generated-HTML the CEM contract declares — a semantic surface-vs-contract verdict, NOT a byte-for-byte source golden (that is mere regression). Surface it as a workbench badge labelled precisely 'surface-contract' (honesty rule: never a bare 'conformance' label). Ownership per #899/constellation-placement: surface vectors/schema → WE, the runner → FUI (locus), badge = FUI-workbench consumer. Catches 'generator dropped an event' before #912's sandbox exists — a different failure class than the behavioral tier (#967).
