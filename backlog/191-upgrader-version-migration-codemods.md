---
type: idea
workItem: story
size: 8
parent: "097"
status: open
dateOpened: "2026-06-08"
blockedBy: ["005", "094", "102"]
tags: [upgrader, codemod, migration, spec-versioning, breaking-change, machine-readable]
relatedProject: webadapters
crossRef: { url: /backlog/094-ai-upgrader-tools/, label: "AI upgrader MVP (#094)" }
---

# Upgrader version-migration codemods — upgrade code across standard/dependency versions

The [#094](/backlog/094-ai-upgrader-tools/) MVP built the **"legacy → standard"** upgrade kind. The
item names a **second kind** not yet built: **"across standard / dependency versions"** — apply
breaking-change codemods when a protocol, adapter, or provider contract evolves, so "upgrade to the
new version" doesn't mean hand-editing every call site. This item is that path.

The hard prerequisite (already flagged on #094): the standard must **publish machine-readable
change/migration descriptors per release** — ties directly to spec versioning
([#005](/backlog/005-validation-spec-versioning-adherence-tooling/)). A descriptor names what
changed (renamed attribute, moved intent dimension, retired provider id) and the mechanical
transform to apply. The upgrader then consumes descriptors and rewrites the consumer's code, **gated
by the same verify pass** so a migrated call site is only offered if it still parses + conforms.

This is distinct from the input-adapter breadth work
([#190](/backlog/190-upgrader-additional-input-adapters/)) — that widens *what* can be lifted in;
this moves *already-conformant* code forward across versions. Likely shares the verify gate and the
registry/provider shape, but adds a descriptor schema + a transform engine. Sized large; may split
once the descriptor format is settled. Sequence after #005 publishes a descriptor format.
