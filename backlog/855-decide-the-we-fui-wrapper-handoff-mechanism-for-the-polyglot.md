---
type: decision
workItem: story
size: 3
parent: "746"
status: open
blockedBy: ["821"]
dateOpened: "2026-06-17"
tags: [webdocs, block-explorer, adapters, polyglot, boundary, decision]
relatedProject: webdocs
crossRef: { url: /backlog/753-polyglot-adapter-panel/, label: "Polyglot adapter panel (#753)" }
---

# Decide the WE→FUI wrapper-handoff mechanism for the polyglot adapter panel

The cross-repo seam blocking [#753](/backlog/753-polyglot-adapter-panel/) (surfaced + flagged at its batch-2026-06-17 claim, never filed until now). #821's wrapper generator (`scripts/gen-wrapper/genWrapper.mjs`) is a **WE** script; the polyglot panel is **FUI** (`locus: frontierui`, per the docs-rendering boundary — WE never renders FUI block code, FUI never imports WE freely). So *how the FUI panel obtains and live-tests the WE-generated React/Vue wrapper source* is undecided: (A) build-time artifact handoff — WE emits the wrappers to a published artifact the FUI panel reads; (B) a generated bundle the `fuiDemo` iframe (#701) loads; (C) a sandbox runtime that generates on demand. Each has different boundary, freshness, and live-test-sandbox implications; the sandbox running generated React/Vue is itself a non-trivial sub-build. Settle the mechanism (a decision, not a mid-batch improvisation) before #753's criteria #1/#2 are built. blockedBy #821 (the generator) — resolved, so this is ready to prepare/ratify.
