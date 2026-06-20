---
type: idea
workItem: story
size: 3
parent: "1038"
status: open
dateOpened: "2026-06-20"
tags: []
relatedProject: webmanifests
---

# Manifest Spec completion — CEM-derivation hardening + forward-compat for richer fields

WE-layer Manifest Spec (webmanifests) completeness: harden the CEM->manifest derivation (we:blocks/renderers/module-service/generation/generate.ts + we:blocks/renderers/module-service/definitionRegistry.ts) and add forward-compat tolerance so richer declared fields are carried, not dropped. Child of the #1038 webdocs spec-surface epic. Demo: derivation unit/golden tests green.
