---
type: idea
workItem: story
size: 3
parent: "1090"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webvalidation: interaction-state model + L1 observable data-* reflection

New we:interaction-state/ model (InteractionState: dirty/touched/focused/submitted per spec we:src/_includes/project-webvalidation.njk:298-303) + reflect merged validity and interaction state as spec data-* attrs in we:plugs/webvalidation/ValidityMergeField.ts:183-191,62-65 (attr list we:src/_includes/project-webvalidation.njk:176-183). Demo: e2e asserts data-validity/dirty/touched/severity flip on input.
