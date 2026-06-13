---
type: issue
workItem: story
size: 5
parent: "097"
status: open
dateOpened: "2026-06-13"
tags: []
---

# Upgrader declarative transform interpreter + imperative codemod escape hatch

Build slice (b) of the ratified #191 version-migration upgrader (Fork 2 = declarative-first). Build the engine-side interpreter that applies a changelog-manifest migration entry's DECLARATIVE transform to a call site (no codemod module to write or trust), plus the imperative escape hatch: when an entry references a codemod (jscodeshift/ts-morph-style) for a transform too complex to declare, run it under #102's author/integrity-hash trust metadata. Includes the held-open sub-decision from #191: enumerate the declarative change-kind vocabulary the engine interprets natively (rename-attr / move-dimension / retire-provider / re-namespace …) against the real breaking-change history. Ready now.
