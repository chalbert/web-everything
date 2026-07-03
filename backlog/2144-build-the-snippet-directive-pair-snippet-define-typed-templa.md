---
kind: story
size: 5
parent: "1975"
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Build the snippet directive pair (snippet-define typed template + no-body render)

Build the ratified snippet pair (#1980 GO) in FUI's webdirectives plug. Applies #1983's forms: snippet:define = inert typed <template type=snippet-define name params> (Fork 1 (a), the catalog row); snippet:render = no-body structural annotation — settle its exact spelling here. Normative fence per #1980: render args are VALUES, not inline expressions (no compute-in-markup). Rider per #1980 ruling: consider a custom-node syntax (customNodes recipe, #2074) as an ADDITIONAL authoring surface for render — not a second canonical form; open legality per delimiter policy #2112. Substrate: author toward Template Instantiation (createInstance + processor). Registration via #1986 CustomTemplateType; naming per #1987. Parent #1975.
