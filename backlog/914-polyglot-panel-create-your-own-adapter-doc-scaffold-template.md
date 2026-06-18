---
type: idea
workItem: story
size: 2
parent: "746"
status: resolved
blockedBy: ["753"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/tools/gen-wrapper/ADDING-A-TARGET.md
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Polyglot panel — create-your-own-adapter doc + scaffold template

Block Explorer polyglot-panel slice (d), sibling of #753. Author the create-your-own-adapter path: a doc page + a scaffold template entry showing how to add a new target generator (Svelte/Angular/…) over the CEM contract. Mostly doc per the #753 body. Home FUI docs + scaffold template. locus:frontierui.

## Built (batch-2026-06-18)

Shipped in **frontierui** — the create-your-own-adapter path for the polyglot generator:

- **`fui:tools/gen-wrapper/ADDING-A-TARGET.md`** — the guide: an emitter is `(CEM declaration) →
  source`; a new target is purely additive (reads the same neutral CEM contract every target reads,
  never a vendor format). Documents the CEM→wrapper mapping (attributes/members/events/slots),
  the register steps (`EMITTERS` + `TARGETS` → the #753 Polyglot panel picks it up automatically),
  and the rules (flag-don't-fake, consume-don't-reimplement).
- **`fui:tools/gen-wrapper/templates/svelte.emitter.template.mjs`** — a worked Svelte 5 emitter
  scaffold (self-contained, copy-rename-fill) reading the CEM declaration fields and emitting
  idiomatic consume-mode wrapper source. Verified it produces correct output for a CEM fixture.

Mostly doc per the #753 body; sibling slice (d) of the polyglot panel. Gate: `check:standards`
green (0 errors). Slices (b) #912 + (c) #913 remain blocked-in-fact (no in-browser transpiler /
no #891 conformance runner yet).
