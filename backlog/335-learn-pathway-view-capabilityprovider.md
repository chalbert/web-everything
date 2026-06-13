---
type: idea
workItem: story
size: 3
status: open
locus: plateau-app
dateOpened: "2026-06-11"
dateStarted: "2026-06-13"
tags: [development-guide, learn-pathway, capability-provider, configurator, docs, diataxis]
---

# Build the learn-pathway view + wire the shared CapabilityProvider content model (interim configurator-native render)

Build the development-guide learn-pathway view as a read-only second view over the configurator's existing `Domain` / `CapabilityProvider` content model (`domain → axes → options → rationale → recommendation`), with a free-browse floor plus a thin curated prev/next path layer. Authoring once and reading twice makes drift structurally impossible. The interim render is configurator-native; migrating onto `webdocs` is the follow-on (#336). Ratified in #109 (Forks 1, 2 & 4): one guide surface with two registers, the `Domain` type as the single source, and a wander-anywhere default with curation added as a layer, not a gate.
